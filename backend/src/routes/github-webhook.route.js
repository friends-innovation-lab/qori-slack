// src/routes/github-webhook.route.js
const express = require('express');
const router = express.Router();
const githubWebhookController = require('../controllers/github-webhook.controller');

// Custom middleware to capture raw body for signature verification
const captureRawBody = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      req.body = {};
    }
    next();
  });
};

// GitHub will POST webhook events here
router.post('/', captureRawBody, githubWebhookController.handleWebhook);

module.exports = router; 
