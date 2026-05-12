# AI Hedging Backend

This repository contains the backend service for the master thesis experiment prototype:

**Designing Uncertainty-Aware AI Interfaces: Verbal Hedging and Trust Calibration in Text and Synthetic Speech**

The backend receives, stores, and exports experiment data submitted by the browser-based participant interface.

## Project purpose

The backend supports a browser-based experiment in which participants evaluate AI-generated answers. The study investigates how verbal hedging and output modality influence trust, verification behaviour, and reliance decisions.

The frontend experiment collects behavioural and questionnaire data, then sends the completed session data to this backend. The backend stores the submitted data as JSON files and provides export endpoints for later analysis.

## Main responsibilities

This backend is responsible for:

- receiving participant session data from the experiment page
- storing submitted data as JSON files
- providing CSV export endpoints
- supporting trial-level data export
- supporting interview and questionnaire data export
- keeping data storage separate from the frontend prototype

## Technology stack

The backend is built with:

- Node.js
- Express.js
- CORS
- JSON file storage

## Repository structure

.
├── data/
├── node_modules/
├── package.json
├── package-lock.json
├── server.js
└── README.md

## Main file

The main application logic is located in:

server.js

This file defines the Express server, API routes, data-saving logic, and export functionality.

## Installation

To install the project dependencies, run:

npm install

## Running locally

To start the backend locally, run:

node server.js

Or, if a start script is configured in `package.json`:

npm start

By default, the server uses the port defined by the environment variable `PORT`. If no port is provided, it falls back to the default port configured in the code.

## Data submission endpoint

The frontend sends participant session data to the backend endpoint configured in the experiment page.

Example frontend configuration:

const WEBHOOK_URL = "https://ai-hedging-backend.onrender.com/api/experiment";

The backend receives a JSON payload containing:

- participant metadata
- assigned condition
- questionnaire responses
- computed questionnaire scores
- trial-level logs
- final reflection responses
- session status

## Stored data

Submitted experiment sessions are stored as JSON files in the `data/` directory.

Each saved file contains:

- `meta`: session-level information
- `logs`: trial-level behavioural data

The trial-level logs include:

- participant ID
- condition
- hedging flag
- modality flag
- item ID
- block number
- trial index
- answer correctness
- displayed answer
- hedge phrase
- hedge type
- verification behaviour
- evidence dwell time
- source-opening behaviour
- final decision
- decision time
- final decision accuracy

The metadata includes:

- informed consent status
- session start and end time
- manipulation check responses
- trust responses
- NASA-TLX responses
- UEQ responses and scores
- post-task responses
- final reflection answers
- session completion status

## Export functionality

The backend provides export routes for downloading collected data.

Depending on the current server implementation, available exports may include:

- full JSON session data
- trial-level CSV data
- interview or reflection CSV data
- questionnaire-level data

These exports are intended for analysis in tools such as Excel, R, Python, SPSS, or JASP.

## Privacy and data handling

The backend is designed for anonymous academic research data.

The frontend does not ask participants for direct personal identifiers such as:

- name
- email address
- phone number

Data is stored using anonymous participant or session identifiers.

The collected data should be used only for academic analysis and should be reported at group level.

## Deployment

This backend can be deployed on a Node.js hosting platform such as Render.

Typical deployment steps:

1. Push the repository to GitHub.
2. Create a new Node.js web service on the hosting platform.
3. Connect the GitHub repository.
4. Set the build command to `npm install`.
5. Set the start command to `node server.js`.
6. Deploy the service.
7. Copy the deployed backend URL.
8. Use that URL as the `WEBHOOK_URL` in the frontend experiment page.

## Environment variables

The backend can use the following environment variable:

PORT

This determines which port the Express server listens on.

When deployed on platforms such as Render, the platform usually sets this automatically.

## Important notes before data collection

Before using the backend for real participant data, test the following:

- the backend starts successfully
- the frontend can send data to the backend
- submitted JSON files are saved correctly
- trial-level CSV export works
- questionnaire or interview export works
- incomplete sessions are handled correctly
- completed sessions contain all expected metadata and logs
- the hosting platform keeps the service active during data collection

## Limitations

This backend is a research prototype, not a production-grade data platform.

Known limitations include:

- data is stored as local JSON files
- file-based storage may not be suitable for large-scale studies
- hosting platforms may restart or sleep inactive services
- data persistence depends on the hosting provider configuration
- no full user authentication is implemented
- server-side validation is limited to prototype-level checks

## Security note

This backend should not expose destructive routes publicly during real data collection.

Any endpoint that clears, deletes, or modifies stored data should be removed, disabled, or protected before deployment.

## Related repository

This backend is intended to be used together with the frontend experiment repository that contains the `index.html` participant interface.
