/**
 * Created by carlos on 25/07/2017.
 */
// main firebase dependencies
const admin = require("firebase-admin");
// helper libraries
function searchPatient(req, res, esClient, logger) {
  //check header
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer ")
  ) {
    return res
      .status(403)
      .send("Unauthorized")
      .end();
  }
  //check parameter
  if (typeof req.body === "undefined") {
    return res.status(400).end();
  }
  var searchParams = req.body;
  //check for empty params
  if (
    (typeof searchParams.name === "undefined" &&
      typeof searchParams.ptRecN === "undefined") ||
    (searchParams.name === "" && searchParams.ptRecN === "")
  ) {
    logger.info("missing name and ptRecN params");
    return res.send([]).end();
  }
  logger.info(JSON.stringify(searchParams));
  // Grab and verify idToken
  const idToken = req.headers.authorization.split("Bearer ")[1];
  return admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedIdToken => {
      const uid = decodedIdToken.uid;
      if (
        decodedIdToken.registered &&
        decodedIdToken.verified &&
        decodedIdToken.authorized
      ) {
        // call elasticsearch node using esClient
        // format a query and send it as a json in the request's body
        // consider a match_query or a simple_query
        var queryBody = {};
        queryBody = {
          query: {
            bool: {
              must: []
            }
          }
        };
        if (searchParams.name !== "") {
          queryBody.query.bool.must.push({
            simple_query_string: {
              query: searchParams.name + "*",
              fields: ["name"]
            }
          });
        }
        if (searchParams.ptRecN !== "") {
          queryBody.query.bool.must.push({
            simple_query_string: {
              query: searchParams.ptRecN + "*",
              fields: ["ptRecN"]
            }
          });
        }
        if (searchParams.status !== "") {
          queryBody.query.bool.must.push({
            term: { status: searchParams.status }
          });
        }
        if (searchParams.wardName !== "") {
          queryBody.query.bool.must.push({
            term: { wardName: searchParams.wardName }
          });
        }
        if (searchParams.wardKey !== "") {
          queryBody.query.bool.must.push({
            term: { wardKey: searchParams.wardKey }
          });
        }
        if (searchParams.specialtyName !== "") {
          queryBody.query.bool.must.push({
            term: { specialtiesNames: searchParams.specialtyName }
          });
        }
        if (searchParams.specialtyKey !== "") {
          queryBody.query.bool.must.push({
            term: { specialtiesKeys: searchParams.specialtyKey }
          });
        }
        logger.info(JSON.stringify(queryBody));
        return esClient
          .search({
            index: "sisphgrs2",
            type: "patients",
            body: queryBody
          })
          .then(resp => {
            var hits = resp.hits.hits;
            return res.send(hits).end();
          })
          .catch(e => {
            logger.error(e);
            console.trace(e.message);
            return res.status(500).end();
          });
      } else {
        logger.info("user: " + uid + " is not authorized");
        return res
          .status(403)
          .send("Unauthorized")
          .end();
      }
    })
    .catch(e => {
      logger.error(e);
      return res.status(500).end();
    });
}
exports.searchPatient = searchPatient;
