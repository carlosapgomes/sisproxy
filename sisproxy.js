// sisproxy.js
// Env vars:
// GOOGLE_APPLICATION_CREDENTIALS = stringfied service-account.json
// PGUSER=pgfts
// PGHOST=127.0.0.1  url to elasticsearch host (default to http://127.0.0.1:5432
// PGPASSWORD=pgfts
// PGDATABASE= sisp
// PGPORT=5432
// JWT_KEY = JWT symmetric key
// SISPROXY_PORT = server listening port
const express = require("express");

const bodyParser = require("body-parser");

const app = express();
require("dotenv").config();

("use strict");
const cors = require("cors");
const morgan = require("morgan");
const logger = require("./config/winston");

app.use(morgan("combined", { stream: logger.stream }));
app.use(bodyParser.json());
app.use(cors({ origin: true }));
app.options("*", cors());
app.enable("trust proxy");

var admin = require("firebase-admin");

const _sodium = require("libsodium-wrappers");
var sodium;
const getAuthToken = require("./modules/getAuthToken.js").getAuthToken;
const getCid = require("./modules/getCid2.js").getCid;
const searchPatient = require("./modules/searchPatient2.js").searchPatient;
// const { searchPatientWithToken } = require("./modules/searchPatientWithToken2")
//  .searchPatientWithToken;
const  searchPatientWithToken  = require("./modules/searchPatientWithToken2").searchPatientWithToken;
const { getCidWithToken }  = require("./modules/getCidWithToken");
const { getDailyNote } = require("./modules/getDailyNote");
const { getPrescription } = require("./modules/getPrescription");
const { getMap } = require("./modules/getMap");
const patientUpdate = require("./modules/patientUpdate.js").patientUpdate;
const addPatient = require("./modules/addPatient.js").addPatient;
const deletePatient = require("./modules/deletePatient.js").deletePatient;
const jwt = require("jsonwebtoken");

const { Pool } = require("pg");
var pgClient;

function getPgConfig() {
  const config = {
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    connectionTimeoutMillis: process.env.PGCONNECT_TIMEOUT
      ? parseInt(process.env.PGCONNECT_TIMEOUT, 10)
      : 10000,
  };

  if (process.env.PGSSLMODE === "disable") {
    config.ssl = false;
  }

  return config;
}

async function initSodium() {
  await _sodium.ready;
  sodium = _sodium;
}

async function initPostgres() {
  pgClient = new Pool(getPgConfig());
  pgClient.on("error", (e) => {
    logger.error(e);
    process.exit(1);
  });
  await pgClient.query("SELECT 1");
}

var serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://sisphgrs.firebaseio.com/"
})
  ? logger.info("App initialized")
  : logger.info("initialization failed");

var esJwtSymmetricKey = {};
esJwtSymmetricKey.secret = process.env.JWT_KEY;

app.get("/", function(req, res) {
  res.status(200).send("It is running!");
});
app.get("/_ah/health", function(req, res) {
  res.status(200).send("It is running!");
});

app.get("/getCid", (req, res) => {
  // must be called with Bearer header idToken and text parameter
  return getCid(req, res, pgClient, logger);
});

// update patient data
app.put("/espatients/update/:patientKey", (req, res) => {
  return patientUpdate(req, res, jwt, esJwtSymmetricKey, pgClient, logger);
});

// add patient data
app.put("/espatients/add/:patientKey", (req, res) => {
  return addPatient(req, res, jwt, esJwtSymmetricKey, pgClient, logger);
});

// remove patient
app.delete("/espatients/:patientKey", (req, res) => {
  return deletePatient(req, res, jwt, esJwtSymmetricKey, pgClient, logger);
});

app.post("/searchPatient", (req, res) => {
  logger.info(JSON.stringify(req.body));
  // must be called with Bearer header idToken and body with search params
  return searchPatient(req, res, pgClient, logger);
});

app.post('/getPrescription', (req, res) => {
  logger.info(JSON.stringify(req.body));
  return getPrescription(req, res, pgClient, sodium, logger);
});
app.get('/getMap', (req, res) => {
  return getMap(req, res, sodium, logger);
});
// must be called with Bearer header token and body with search params
app.post('/getDailyNote', (req, res) => {
  logger.info(JSON.stringify(req.body));
  return getDailyNote(req, res, pgClient, sodium, logger);
});
app.post('/searchCidWithToken', (req, res) => {
  logger.info(JSON.stringify(req.body));
  return getCidWithToken(req, res, pgClient, sodium, logger);
});
app.post('/searchPatientWithToken', (req, res) => {
  logger.info(JSON.stringify(req.body));
  // must be called with Bearer header token and body with search params
  return searchPatientWithToken(req, res, pgClient, sodium, logger);
});
app.get("/getAuthToken", function(req, res) {
  return getAuthToken(req, res);
});

async function shutdown(server) {
  if (pgClient) {
    await pgClient.end();
    console.log("Postgres connection closed.");
  }

  await new Promise((resolve) => {
    server.close(() => {
      console.log("Http server closed.");
      resolve();
    });
  });
}

async function start() {
  await initSodium();
  await initPostgres();

  return new Promise((resolve, reject) => {
    const server = app.listen(
      process.env.SISPROXY_PORT || 8081,
      "127.0.0.1",
      () => {
        const port = server.address().port;
        logger.info(`App listening on port ${port}`);
        resolve(server);
      }
    );

    server.on("error", reject);
  });
}

if (module === require.main) {
  start()
    .then((server) => {
      process.on("SIGTERM", async () => {
        console.info("SIGTERM signal received.");
        try {
          await shutdown(server);
          process.exit(0);
        } catch (e) {
          logger.error(e);
          process.exit(1);
        }
      });
    })
    .catch((e) => {
      logger.error(e);
      process.exit(1);
    });
}
module.exports = app;
