/**
 * Created by carlos on 22/07/2017.
 */
function esPatientUpdate(req, res, jwt, esJwtSymmetricKey, esClient, logger) {
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
        logger.info("error verifying jwt token");
        return res
          .status(500)
          .send("error")
          .end();
      } else {
        // jwtToken is valid
        // remove patient from ES node
        var patientKey = req.params.patientKey;
        logger.info("Updating patient: " + patient.name);
        logger.info("patientKey: " + patientKey);
        return esClient
          .update({
            index: "sisphgrs2",
            type: "patients",
            id: patientKey,
            body: {
              doc: {
                name: patient.name,
                ptRecN: patient.ptRecN,
                status: patient.status,
                wardName: patient.ward,
                wardKey: patient.wardKey,
                bed: patient.bed,
                specialtiesKeys: patient.specialtiesKeys,
                specialtiesNames: patient.specialtiesNames
              },
              doc_as_upsert: true
            }
          })
          .then(resp => {
            return res.send(resp).end();
          })
          .catch(e => {
            logger.info("error updating ES");
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

exports.esPatientUpdate = esPatientUpdate;
