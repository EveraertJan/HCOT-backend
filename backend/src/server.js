const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");
const uuidV1 = require("uuid");
const jwt = require("jwt-simple");
const md5 = require("md5");
const app = express();
const server = http.Server(app);
const retryKnex = require('./retryKnex');

const PORT = 3000;

class App {
  constructor(opts) {
    this.pg = require("knex")({
      client: "pg",
      version: '9.6',
      connection: process.env.PG_CONNECTION_STRING,
      searchPath: ['knex', 'public'],
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
      await this.pg
        .select('*')
        .table("measures").then((d) => {
          res.status(200).send(d)
        })
    });

    app.get("/live", async (req, res, next) => {
      await this.pg
        .raw(`SELECT DISTINCT "sensorID"
          FROM measures;`)
        
        .then(async (d) => {
          const total = [];
          await d.rows.forEach(async (e) => {
            await this.pg
            .select('*')
            .table('measures')
            .where({ sensorID: e.sensorID})
            .limit(1)
            .orderBy('key', 'desc')
            .then((c) => {
              total.push(c)
              if(total.length == d.rows.length) {

               res.status(200).send(total)
              }
            })
            .catch((e) => {
              res.status(400).send(e);
            })
          });
        })
        .catch((e) => {
          res.status(400).send(e);
        })
    });
    app.post("/", async (req, res, next) => {

      const uuid = uuidV1();
      const body = {
        ...req.body,
        uuid: uuid
      }


      await this.pg
        .insert(body)
        .table('measures')
        .returning('*')
        .then((d) => {
          res.status(200).send(d)
        })
    });


    server.listen(3000, () => {
      console.log(`server up and listening on ${PORT}`);
    });

    return await retryKnex(async () => {
      const self = this;

      await this.pg
        .raw('select 1+1 as result')
        .then(async (resolve, reject) => {
          resolve();
          return true
        })
        .catch((error) => {
          console.log('- error:', error.code);
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
            table.increments('key');
            table.uuid("uuid");
            table.string('sensorID');
            table.float('decibelValue');
            table.string('decibelTimerange');
            table.string('timestamp');
            table.string('geohash');
            table.text('detected', 'longtext');
            table.timestamps(true, true);
          })
          .then(function() {
            console.log("created measures");
          });
      }
    });

    // await this.pg.schema.hasTable("measures").then(function(exists) {
    //   if (exists) {
    //     return _this.pg.schema
    //       .alterTable("measures", function(table) {
    //         table.dropColumn("decibelTimerange");

    //       })
    //       .then(function() {
    //         console.log("removed");
    //       });
    //   }
    // });
    // await this.pg.schema.hasTable("measures").then(function(exists) {
    //   if (exists) {
    //     return _this.pg.schema
    //       .alterTable("measures", function(table) {
    //         table.integer("decibelTimerange");

    //       })
    //       .then(function() {
    //         console.log("updated");
    //       });
    //   }
    // });
  }
}
module.exports = App;
