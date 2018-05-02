import { APIGatewayEvent, Callback, Context, Handler } from 'aws-lambda';
import { google } from 'googleapis';
import { SavageDataInput, AvgDataTopic, MemberDataTopic, SoloDataTopic } from './types';
import { Schema$Spreadsheet, Schema$GridData } from 'googleapis/build/src/apis/sheets/v4';
import { JWT } from 'google-auth-library';
import { Drive } from 'googleapis/build/src/apis/drive/v3';
import { Sheets } from 'googleapis/build/src/apis/sheets/v4';
const privatekey = require('./auth.json');


const getAuthorizedJWT = async (): Promise<JWT> => {
    const jwtClient = new JWT(
      privatekey.client_email,
      null,
      privatekey.private_key,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    );
    await jwtClient.authorize();
    return jwtClient;
}

const setFileOwner = async (driveApi: Drive, fileId: string, email: string): Promise<any> => {
    const res: any = await driveApi.permissions.create({
      resource: {
        type: 'user',
        role: 'owner',
        emailAddress: email
      },
      fileId: fileId,
      fields: 'id',
      transferOwnership: true
    });
}

const getValueArraysForAvg = (data: AvgDataTopic): any => {
  const res = [
    [data.title, "", "", "", "", "", "", ""],
    [
      data.fieldLabels.type,
      data.fieldLabels.killFame,
      data.fieldLabels.deathFame,
      data.fieldLabels.fameKd,
      data.fieldLabels.kills,
      data.fieldLabels.deaths,
      data.fieldLabels.rawKd,
      data.fieldLabels.killShots
    ]
  ];

  data.rows.forEach(row => {
    res.push([
      row.type,
      row.killFame,
      row.deathFame,
      row.fameKd,
      row.kills,
      row.deaths,
      row.rawKd,
      row.killShots
    ]);
  });

  return res;
}


const getValueArraysForMembers = (data: MemberDataTopic): any => {
  const res = [
    [data.title, "", "", "", "", "", "", ""],
    [
      data.fieldLabels.member,
      data.fieldLabels.killFame,
      data.fieldLabels.deathFame,
      data.fieldLabels.fameKd,
      data.fieldLabels.kills,
      data.fieldLabels.deaths,
      data.fieldLabels.rawKd,
      data.fieldLabels.killShots
    ]
  ];

  data.rows.forEach(row => {
    res.push([
      row.member,
      row.killFame,
      row.deathFame,
      row.fameKd,
      row.kills,
      row.deaths,
      row.rawKd,
      row.killShots
    ]);
  });
  return res;
}

const getValueArraysForSolos = (data: SoloDataTopic): any => {
  const res = [
    [data.title, "", "", "", "", "", ""],
    [
      data.fieldLabels.member,
      data.fieldLabels.killFame,
      data.fieldLabels.deathFame,
      data.fieldLabels.fameKd,
      data.fieldLabels.kills,
      data.fieldLabels.deaths,
      data.fieldLabels.rawKd,
    ]
  ];
  data.rows.forEach(row => {
    res.push([
      row.member,
      row.killFame,
      row.deathFame,
      row.fameKd,
      row.kills,
      row.deaths,
      row.rawKd,
    ]);
  });
  return res;
}

const insertDataToSpreadsheet = async (sheetsApi: Sheets, spreadsheetId: string, data: SavageDataInput): Promise<void> => {

  // Set avg section
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: "Sheet1!A1:H7",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: getValueArraysForAvg(data.avg)
    }
  });

  // Set member section
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: "Sheet1!A7:H",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: getValueArraysForMembers(data.members)
    }
  });

  // Set solo section
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: "Sheet1!J1:P",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: getValueArraysForSolos(data.solo)
    }
  });
}


const createAndFillSpreadSheet = async (event: APIGatewayEvent): Promise<string> => {
  const OWNER_EMAIL = process.env.OWNER_EMAIL;

  const jwtCreds = await getAuthorizedJWT();

  const sheetsApi: Sheets = google.sheets({
    version: "v4",
    auth: jwtCreds
  });

  const driveApi: Drive = google.drive({
    version: "v3",
    auth: jwtCreds
  });
  
  const today = new Date();

  const spreadsheet = (await sheetsApi.spreadsheets.create({
    resource: {
      properties: {
        title: `AlbionStats-${today.getFullYear()}-${today.getMonth()}-${today.getUTCDate()}-${today.getTime()}`
      }
    }
  })).data;

  await insertDataToSpreadsheet(sheetsApi, spreadsheet.spreadsheetId, JSON.parse(event.body) as SavageDataInput); 

  await setFileOwner(driveApi, spreadsheet.spreadsheetId, OWNER_EMAIL);

  return spreadsheet.spreadsheetUrl;

};


export const newSpreadsheet: Handler = (event: APIGatewayEvent, context: Context, cb: Callback) => {

  createAndFillSpreadSheet(event)
    .then((url) => {
      cb(null, {
        statusCode: 200,
        body: JSON.stringify({
          url: url
        })
      });
    })
    .catch((e) => {
      console.log(e);
      cb(null, {
        statusCode: 500,
        body: JSON.stringify({
          message: "Internal Server Error"
        })
      })
    })
  
};
