const express = require("express");
const router = express.Router();
const dockerController = require("../controllers/dockerController");

// Routes
router.post("/clone", dockerController.cloneIntoSandbox);
router.post("/exec", dockerController.execInSandbox);
router.get("/status/:containerName", dockerController.getSandboxStatus);
router.delete("/destroy/:containerName", dockerController.destroySandbox);

module.exports = router;
