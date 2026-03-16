/**
 * Created by carlos on 21/07/2017.
 */
function esDel(req, res, jwt, esJwtSymmetricKey, esClient, logger) {
  //check header
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer ")
  ) {
    logger.info("no headers");
    return res
      .status(403)
      .send("Unauthorized")
      .end();
  }
  if (esJwtSymmetricKey === null) {
    logger.info("no jwt key");
    return res
      .status(500)
      .send("error")
      .end();
  }
  // Grab and verify idToken
  const jwtToken = req.headers.authorization.split("Bearer ")[1];
  if (jwtToken) {
    // verifies secret and checks exp
    return jwt.verify(jwtToken, esJwtSymmetricKey.secret, function(
      err,
      decoded
    ) {
      if (err) {
        logger.error(err);
        return res
          .status(500)
          .send("error")
          .end();
      } else {
        // jwtToken is valid
        // remove patient from ES node
        var patientKey = req.params.patientKey;
        logger.info("removing patientKey: " + patientKey + " from ES node.");
        return esClient
          .delete({
            index: "sisphgrs2",
            type: "patients",
            id: patientKey
          })
          .then(resp => {
            return res.send(resp).end();
          })
          .catch(e => {
            logger.error(e);
            return res
              .status(500)
              .send("error")
              .end();
          });
      }
    });
  } else {
    logger.info("no token");
    return res
      .status(500)
      .send("error")
      .end();
  }
}

exports.esDel = esDel;
