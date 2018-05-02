

// Interfaces describing the incoming JSON
export interface AvgDataTopic {
  title: string;
  fieldLabels: AvgDataSet;
  rows: AvgDataSet[];
}

export interface MemberDataTopic {
  title: string;
  fieldLabels: MemberDataSet;
  rows: MemberDataSet[];
}

export interface SoloDataTopic {
  title: string;
  fieldLabels: SoloDataSet;
  rows: SoloDataSet[];
}

export interface DataSet {
  killFame: string | number;
  deathFame: string | number;
  fameKd: string | number;
  kills: string | number;
  deaths: string | number;
  rawKd: string | number;
}

export interface AvgDataSet extends DataSet {
  type: string;
  killShots: string | number;
}

export interface MemberDataSet extends DataSet {
  member: string;
  killShots: string | number;
}

export interface SoloDataSet extends DataSet {
  member: string;
}

export interface SavageDataInput {
  avg: AvgDataTopic;
  members: MemberDataTopic;
  solo: SoloDataTopic;
  email: string;
}

