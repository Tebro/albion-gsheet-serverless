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
const removeServiceAccountPermission = async (driveApi: Drive, fileId: string): Promise<void> => {
  const permissions = (await driveApi.permissions.list({
    fileId
  })).data;

  const serviceAccountPermssion = permissions.permissions.filter(p => p.role !== 'owner');

  await driveApi.permissions.delete({
    fileId,
    permissionId: serviceAccountPermssion[0].id
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
                ...range
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

interface CellColor {
  red: number;
  blue: number;
  green: number;
}

interface CellRange {
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}


const setCellBackgroundAndAlignment = async (sheetsApi: Sheets,
  spreadsheetId: string,
  range: CellRange,
  color: CellColor,
  horizontalAlignment: string = "",
  verticalAlignment: string = ""): Promise<void> => {

    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                ...range
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    ...color
                  },
                  horizontalAlignment,
                  verticalAlignment
                }
              },
              fields: "userEnteredFormat(backgroundColor, horizontalAlignment, verticalAlignment)"
            }
          }
        ]
      }
    });
}

const formatSpreadsheet = async (sheetsApi: Sheets, spreadsheetId: string): Promise<void> => {
  const avgHeaderRange: CellRange = {startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8};
  const membersHeaderRange: CellRange = {startRowIndex: 0, endRowIndex: 1, startColumnIndex: 9, endColumnIndex: 16};
  const soloHeaderRange: CellRange = {startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 8};

  await mergeCells(sheetsApi, spreadsheetId, avgHeaderRange, MergeType.MERGE_ALL);
  await mergeCells(sheetsApi, spreadsheetId, membersHeaderRange, MergeType.MERGE_ALL);
  await mergeCells(sheetsApi, spreadsheetId, soloHeaderRange, MergeType.MERGE_ALL);


  const avgHeaderWithColumnHeadersRange: CellRange = {startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8};
  const membersHeaderWithColumnHeadersRange: CellRange = {startRowIndex: 6, endRowIndex: 8, startColumnIndex: 0, endColumnIndex: 8};
  const soloHeaderWithColumnHeadersRange: CellRange = {startRowIndex: 0, endRowIndex: 2, startColumnIndex: 9, endColumnIndex: 16};


  const avgHeaderColor: CellColor = {red: 0.3, blue: 0.3, green: 0.8};
  const membersHeaderColor: CellColor = {red: 0.3, blue: 0.8, green: 0.3};
  const soloHeaderColor: CellColor = {red: 0.6, blue: 0.6, green: 0.3};

  await setCellBackgroundAndAlignment(sheetsApi, spreadsheetId, avgHeaderWithColumnHeadersRange, avgHeaderColor, "CENTER", "MIDDLE");
  await setCellBackgroundAndAlignment(sheetsApi, spreadsheetId, membersHeaderWithColumnHeadersRange, membersHeaderColor, "CENTER", "MIDDLE");
  await setCellBackgroundAndAlignment(sheetsApi, spreadsheetId, soloHeaderWithColumnHeadersRange, soloHeaderColor, "CENTER", "MIDDLE");

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

  await removeServiceAccountPermission(driveApi, spreadsheet.spreadsheetId);

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
