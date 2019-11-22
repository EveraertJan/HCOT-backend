## POST TO `/posts`

expects the following data

```
{
  title: String: title of the post,
  content: String: content of the post
}
```

returns a full object with the UUID, id and dates (created and updated)

## PATCH TO `/posts/[id]`

expects the following data

```
{
  title: String: title of the post,
  content: String: content of the post
}
```

returns a full object with the UUID, id and dates (created and updated)

## GET to `/posts`

returns an array with all the known posts

## GET to '/posts/[id]`

where `[id]` is the id of the post,
returns a single post object

## DELETE to '/posts/[id]`

removes the post from the database (use with caution)
