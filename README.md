# Savage Albion Gsheets serverless

A simple POST endpoint...

- Install nodejs.
- Install serverless `npm install -g serverless`
- Create an AWS account 
- Install and configure AWS CLI `pip install awscli; aws configure`
- Edit the serverless.yml file to your liking
- Install dependencies `yarn install`
- Log into google cloud console and create a service account and download credentials for it to ./auth.json
- Deploy `sls deploy`


The install process will output the POST endpoints URL. The types.ts file can be used for reference on correct data structure for JSON.