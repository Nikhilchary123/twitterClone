const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertReplyDbObjectToResponseObject = (dbObject) => {
  return {
    replyId: dbObject.reply_id,
    tweetId: dbObject.tweet_name,
    username: dbObject.username,
    reply: dbObject.reply,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
    tweet: dbObject.tweet,
    likeId: dbObject.like_id,
    likes: dbObject.likes,
    replies: dbObject.replies,
  };
};

//validatePassword

const validatePassword = (password) => {
  return password.length > 6;
};

//authenticateToken

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
}

//register api

app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;
  console.log(request.body);
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  console.log(username);
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
       user (username, password, name,  gender)
     VALUES
      (
       '${username}',
       '${hashedPassword}',
       '${name}',
       '${gender}'
       );`;
    if (validatePassword(password)) {
      await database.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);

  const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

  const userId = await database.get(getUserId);

  console.log(userId.user_id);
  const getFeedQuery = `
      SELECT
        username,tweet,date_time
      FROM
        follower INNER JOIN tweet ON following_user_id=tweet.user_id
        INNER JOIN user ON tweet.user_id=user.user_id

      WHERE
      follower_user_id=${userId.user_id}

      ORDER BY date_time DESC
      LIMIT 4;`;
  const feedArray = await database.all(getFeedQuery);
  response.send(
    feedArray.map((eachFeed) => convertReplyDbObjectToResponseObject(eachFeed))
  );
});

//api4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);

  const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

  const userId = await database.get(getUserId);

  console.log(userId.user_id);
  const getFeedQuery = `
      SELECT
        username
      FROM
        follower INNER JOIN user ON following_user_id=user.user_id
        
      WHERE
      follower_user_id=${userId.user_id};`;
  const feedArray = await database.all(getFeedQuery);
  response.send(
    feedArray.map((eachFeed) => convertReplyDbObjectToResponseObject(eachFeed))
  );
});

//api5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);

  const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

  const userId = await database.get(getUserId);

  console.log(userId.user_id);
  const getFeedQuery = `
      SELECT
        username
      FROM
        follower INNER JOIN user ON follower.follower_user_id=user.user_id

      WHERE
      following_user_id=${userId.user_id};`;
  const feedArray = await database.all(getFeedQuery);
  response.send(
    feedArray.map((eachFeed) => convertReplyDbObjectToResponseObject(eachFeed))
  );
});

//api6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  console.log(username);
  console.log(tweetId);

  const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

  const userId = await database.get(getUserId);

  console.log(userId.user_id);

  const getFollowingUserIds = `
  SELECT
        following_user_id
      FROM
        follower

      WHERE
      follower_user_id=${userId.user_id};`;
  const followingUserIds = await database.all(getFollowingUserIds);

  console.log(followingUserIds);

  const getTwitterIdsUserId = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id=${tweetId};`;

  const twitterIdsUserId = await database.get(getTwitterIdsUserId);

  console.log(twitterIdsUserId.user_id);

  if (twitterIdsUserId.user_id in followingUserIds) {
    const getDetails = `
    SELECT tweet.tweet,COUNT (DISTINCT like.like_id),COUNT (DISTINCT reply.reply_id), tweet.date_time FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id INNER JOIN reply ON like.tweet_id=reply.tweet_id WHERE tweet.tweet_id=${tweetId};`;

    const details = await database.get(getDetails);
    response.send(
      details.map((eachFeed) => convertReplyDbObjectToResponseObject(eachFeed))
    );
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//api7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    console.log(username);
    console.log(tweetId);

    const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

    const userId = await database.get(getUserId);

    console.log(userId.user_id);

    const getFollowingUserIds = `
  SELECT
        following_user_id
      FROM
        follower

      WHERE
      follower_user_id=${userId.user_id};`;
    const followingUserIds = await database.all(getFollowingUserIds);

    console.log(followingUserIds);

    const getTwitterIdsUserId = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id=${tweetId};`;

    const twitterIdsUserId = await database.get(getTwitterIdsUserId);

    console.log(twitterIdsUserId.user_id);

    if (twitterIdsUserId.user_id in followingUserIds) {
      const getDetails = `
    SELECT DISTINCT user.username FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id INNER JOIN user ON like.tweet_id=user.tweet_id WHERE tweet.tweet_id='${tweetId}';`;

      const details = await database.get(getDetails);
      response.send(
        details.map((eachFeed) =>
          convertReplyDbObjectToResponseObject(eachFeed)
        )
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    console.log(username);
    console.log(tweetId);

    const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

    const userId = await database.get(getUserId);

    console.log(userId.user_id);

    const getFollowingUserIds = `
  SELECT
        following_user_id
      FROM
        follower

      WHERE
      follower_user_id=${userId.user_id};`;
    const followingUserIds = await database.all(getFollowingUserIds);

    console.log(followingUserIds);

    const getTwitterIdsUserId = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id=${tweetId};`;

    const twitterIdsUserId = await database.get(getTwitterIdsUserId);

    console.log(twitterIdsUserId.user_id);

    if (twitterIdsUserId.user_id in followingUserIds) {
      const getDetails = `
    SELECT DISTINCT reply.reply FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id WHERE tweet.tweet_id='${tweetId}';`;

      const details = await database.get(getDetails);
      response.send(
        details.map((eachFeed) =>
          convertReplyDbObjectToResponseObject(eachFeed)
        )
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;

  console.log(username);

  const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

  const userId = await database.get(getUserId);

  console.log(userId.user_id);

  const getDetails = `
    SELECT tweet.tweet,COUNT (DISTINCT like.user_id) AS likes,COUNT (DISTINCT reply.reply_id) AS replies,tweet.date_time
    FROM tweet INNER JOIN like on tweet.tweet_id=like.tweet_id 
    INNER JOIN reply ON like.tweet_id=reply.tweet_id
    WHERE tweet.user_id='${userId.user_id}' GROUP BY tweet.tweet;`;

  const details = await database.all(getDetails);
  console.log(details);
  response.send(
    details.map((eachFeed) => convertReplyDbObjectToResponseObject(eachFeed))
  );
});

//api10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;

  console.log(username);

  const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

  const userId = await database.get(getUserId);

  console.log(userId.user_id);

  const getDetails = `INSERT INTO tweet (tweet)
  VALUES('${tweet}');`;

  const details = await database.run(getDetails);
  console.log(details);
  response.send("Created a Tweet");
});

//api11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    console.log(username);
    const getUserId = `SELECT user_id FROM user WHERE 
  username='${username}';
  `;

    const userId = await database.get(getUserId);

    console.log(userId.user_id);

    const getTweetIds = `
  SELECT tweet_id FROM tweet WHERE user_id=${userId.user_id};`;

    const tweetIds = await database.all(getTweetIds);

    console.log(tweetIds);

    if (tweetId.tweet_id in tweetIds) {
      const deleteQuery = `
        DELETE FROM tweet
        WHERE tweet_id='${tweetId.tweet_id}';`;

      const deletedQuery = await database.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
