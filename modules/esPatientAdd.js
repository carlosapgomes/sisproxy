/**
 * Created by carlos on 30/07/2017.
 */
function esPatientAdd(req, res, jwt, esJwtSymmetricKey, esClient, logger) {
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
  if (esJwtSymmetricKey === null) {
    logger.info("no jwt key");
    return res
      .status(500)
      .send("error")
      .end();
  }
  var patient = req.body;
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
        var patientKey = req.params.patientKey;
        logger.info("Adding new patient to ES:");
        logger.info("Key: " + patientKey);
        logger.info("Name: " + patient.name);
        logger.info("RecNumber: " + patient.ptRecN);
        return esClient
          .create({
            index: "sisphgrs2",
            type: "patients",
            id: patientKey,
            body: {
              name: patient.name,
              ptRecN: patient.ptRecN,
              status: patient.status,
              wardName: patient.ward,
              wardKey: patient.wardKey,
              bed: patient.bed,
              specialtiesKeys: patient.specialtiesKeys,
              specialtiesNames: patient.specialtiesNames
            }
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

exports.esPatientAdd = esPatientAdd;
