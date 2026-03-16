/**
 * Created by carlos on 17/07/2017.
 */
// main firebase dependencies
const admin = require("firebase-admin");
// helper libraries
function getCid(req, res, pgClient, logger) {
  //check header
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer ")
  ) {
    res
      .status(403)
      .send("Unauthorized")
      .end();
    return logger.info("no headers");
  }
  //check parameter
  if (typeof req.query.text === "undefined") {
    return res.status(400).end();
  }

  //check for empty text string
  if (req.query.text === "") {
    return res.send([]).end();
  }
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
        // search pg db
        let values = [req.query.text];
        let q =
          "SELECT * , ts_rank_cd(docvectors, query) AS rank FROM cid, websearch_to_tsquery('Portuguese', $1) query  WHERE query @@ docvectors order by rank DESC";
        // logger.info(JSON.stringify(q));
        return pgClient
          .query(q, values)
          .then(result => {
            return res.send(result.rows).end();
          })
          .catch(e => {
            logger.error(e);
            console.trace(e.message);
            return res.status(500).end();
          });
      } else {
        logger.info("user is not authorized");
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
exports.getCid = getCid;
