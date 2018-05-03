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

const createNewSpreadsheet = async (sheetsApi: Sheets): Promise<Schema$Spreadsheet> => {
  const today = new Date();

  return (await sheetsApi.spreadsheets.create({
    resource: {
      properties: {
        title: `AlbionStats-${today.getFullYear()}-${today.getMonth()}-${today.getUTCDate()}-${today.getTime()}`
      }
    }
  })).data;
}


const mergeCells = async (sheetsApi: Sheets,
  spreadsheetId: string,
  range: CellRange,
  mergeType: MergeType): Promise<void> => {

    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            mergeCells: {
              range: {
                sheetId: 0,
                startRowIndex: range.startRow,
                endRowIndex: range.endRow,
                startColumnIndex: range.startColumn,
                endColumnIndex: range.endColumn
              },
              mergeType: mergeType
            }
          }
        ]
      }
    });
}

enum MergeType {
  MERGE_ALL = "MERGE_ALL",
  MERGE_COLUMNS = "MERGE_COLUMNS",
  MERGE_ROWS = "MERGE_ROWS"
}

interface CellRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

const formatSpreadsheet = async (sheetsApi: Sheets, spreadsheetId: string): Promise<void> => {
  const avgHeaderRange: CellRange = {startRow: 0, endRow: 1, startColumn: 0, endColumn: 8}; 
  const membersHeaderRange: CellRange = {startRow: 0, endRow: 1, startColumn: 9, endColumn: 16}; 
  const soloHeaderRange: CellRange = {startRow: 6, endRow: 7, startColumn: 0, endColumn: 8}; 

  await mergeCells(sheetsApi, spreadsheetId, avgHeaderRange, MergeType.MERGE_ALL);
  await mergeCells(sheetsApi, spreadsheetId, membersHeaderRange, MergeType.MERGE_ALL);
  await mergeCells(sheetsApi, spreadsheetId, soloHeaderRange, MergeType.MERGE_ALL);
}

const createAndFillSpreadSheet = async (event: APIGatewayEvent): Promise<string> => {

  const jwtCreds = await getAuthorizedJWT();

  const sheetsApi: Sheets = google.sheets({
    version: "v4",
    auth: jwtCreds
  });

  const driveApi: Drive = google.drive({
    version: "v3",
    auth: jwtCreds
  });
  
  const spreadsheet = await createNewSpreadsheet(sheetsApi);

  const input: SavageDataInput = JSON.parse(event.body);

  await insertDataToSpreadsheet(sheetsApi, spreadsheet.spreadsheetId, input);

  await formatSpreadsheet(sheetsApi, spreadsheet.spreadsheetId);

  await setFileOwner(driveApi, spreadsheet.spreadsheetId, input.email);

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
