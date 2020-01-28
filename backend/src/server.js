const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");
const uuidV1 = require("uuid");
const jwt = require("jwt-simple");
const md5 = require("md5");
const moment = require("moment");
const app = express();
const server = http.Server(app);
const retryKnex = require("./retryKnex");
const path = require("path");

const PORT = 3000;

class App {
  constructor(opts) {
    this.pg = require("knex")({
      client: "pg",
      version: "9.6",
      connection: process.env.PG_CONNECTION_STRING,
      searchPath: ["knex", "public"],
      pool: {
        min: 2,
        max: 6,
        createTimeoutMillis: 3000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false // <- default is true, set to false
      }
    });

    const _this = this;

    this.pg.raw("select 1+1 as result").then(function() {
      _this.initialiseTables();
    });

    this.start = this.start.bind(this);

    this.app = express();
    this.s = http.Server(this.app);
  }

  async start() {
    app.use(bodyParser.json()); // to support JSON-encoded bodies

    app.use(cors({ credentials: false, origin: "*" }));

    app.get("/", async (req, res, next) => {
      res.status(200).send();
    });
    app.use("/help", express.static(path.join(__dirname, "public")));

    app.get("/limited/:amount", async (req, res, next) => {
      const amount = parseInt(req.params.amount);
      await this.pg
        .select("*")
        .table("measures")
        .limit(amount)
        .orderBy("key", "DESC")
        .then(d => {
          res.status(200).send(d);
        })
        .catch(e => console.log(e));
    });

    app.get("/csv", async (req, res, next) => {
      await this.pg
        .select("*")
        .table("measures")
        .then(d => {
          res.writeHead(200, {
            "Content-Type": "text/csv",
            "Content-Disposition": "attachment; filename=*custom_name*.csv"
          });
          res.end(
            dataToCSV(d, [
              "key",
              "uuid",
              "sensorID",
              "decibelValue",
              "decibelTimerange",
              "timestamp",
              "geohash",
              "detected"
            ]),
            "binary"
          );

          // res.status(200).send(d);
        })
        .catch(e => console.log(e));
    });

    app.get("/clean", async (req, res, next) => {
      await this.pg
        .delete()
        .table("measures")
        .returning("*")
        .then(d => {
          res.send("sorry");
        });
    });

    app.get("/populate/:number", async (req, res, next) => {
      const amount = parseInt(req.params.number);
      const sendBack = [];
      const now = moment().utc();
      for (let i = 0; i < amount; i++) {
        const uuid = uuidV1();

        const body = {
          sensorID: `sensor-${Math.round(Math.random() * 5)}`,
          decibelValue: Math.round(Math.random() * 12000) / 100,
          decibelTimerange: Math.round(Math.random() * 20),
          geohash: "u14dkv5rs7wn",
          timestamp: moment(now)
            .subtract(i, "days")
            .format(),
          detected: {},
          uuid: uuid
        };
        await this.pg
          .insert(body)
          .table("measures")
          .returning("*")
          .then(d => {
            sendBack.push(d);
          });
      }
      res.status(200).send(sendBack);
    });

    app.get("/live", async (req, res, next) => {
      await this.pg
        .raw(
          `SELECT DISTINCT "sensorID"
          FROM measures;`
        )

        .then(async d => {
          const total = [];
          await d.rows.forEach(async e => {
            await this.pg
              .select("*")
              .table("measures")
              .where({ sensorID: e.sensorID })
              .limit(1)
              .orderBy("key", "desc")
              .then(c => {
                if (c.length > 0) {
                  total.push(c[0]);
                }
                if (total.length == d.rows.length) {
                  res.status(200).send(total);
                }
              })
              .catch(e => {
                res.status(400).send(e);
              });
          });
        })
        .catch(e => {
          res.status(400).send(e);
        });
    });
    app.post("/", async (req, res, next) => {
      const uuid = uuidV1();
      const body = {
        ...req.body,
        uuid: uuid
      };
      await this.pg
        .insert(body)
        .table("measures")
        .returning("*")
        .then(d => {
          res.status(200).send(d);
        });
    });

    server.listen(3000, () => {
      console.log(`server up and listening on ${PORT}`);
    });

    return await retryKnex(async () => {
      const self = this;

      await this.pg
        .raw("select 1+1 as result")
        .then(async (resolve, reject) => {
          resolve();
          return true;
        })
        .catch(error => {
          console.log("- error:", error.code);
          setTimeout(retryKnex(), 5000);
        });
    });
  }

  async initialiseTables() {
    const _this = this;
    await this.pg.schema.hasTable("measures").then(function(exists) {
      if (!exists) {
        return _this.pg.schema
          .createTable("measures", function(table) {
            table.increments("key");
            table.uuid("uuid");
            table.string("sensorID");
            table.float("decibelValue");
            table.integer("decibelTimerange");
            table.string("timestamp");
            table.string("geohash");
            table.text("detected", "longtext");
            table.timestamps(true, true);
          })
          .then(function() {
            console.log("created measures");
          });
      }
    });
  }
}

function dataToCSV(dataList, headers) {
  var allObjects = [];
  // Pushing the headers, as the first arr in the 2-dimensional array 'allObjects' would be the first row
  allObjects.push(headers);

  //Now iterating through the list and build up an array that contains the data of every object in the list, in the same order of the headers
  dataList.forEach(function(object) {
    var arr = [];
    headers.forEach(e => {
      arr.push(object[e]);
    });
    // arr.push(object.id);
    // arr.push(object.term);
    // arr.push(object.Date);

    // Adding the array as additional element to the 2-dimensional array. It will evantually be converted to a single row
    allObjects.push(arr);
  });

  // Initializing the output in a new variable 'csvContent'
  var csvContent = "";

  // The code below takes two-dimensional array and converts it to be strctured as CSV
  // *** It can be taken apart from the function, if all you need is to convert an array to CSV
  allObjects.forEach(function(infoArray, index) {
    var dataString = infoArray.join(",");
    csvContent += index < allObjects.length ? dataString + "\n" : dataString;
  });

  // Returning the CSV output
  return csvContent;
}

module.exports = App;
