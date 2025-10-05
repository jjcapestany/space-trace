import { Entity } from "cesium";

export type CollisionWarning = {
  satelliteName: string;
  closestDistance: number;
  timeOfClosestApproach: Date;
  flightPosition: { lat: number; lon: number; altitude: number };
  satellitePosition: { lat: number; lon: number; altitude: number };
  severity: "safe" | "warning" | "danger" | "critical";
}

export type SafetyReport = {
  flightId: number;
  flightName: string;
  totalSatellitesChecked: number;
  conflictsFound: number;
  warnings: CollisionWarning[];
  overallStatus: "safe" | "warning" | "danger";
}

export type RegistrationInformationType = {
    id: number;
    flightName: string;
    startingLatitude: number;
    startingLongitude: number;
    endingLatitude: number;
    endingLongitude: number;
    launchDateAndTime: Date;
    landingDateAndTime: Date;
    maxAltitude: number;
    modelOfSpaceCraft: string;
}

export type ExtendedRegistrationInfo = RegistrationInformationType & {
  visible: boolean;
  entities: Entity[];
  safetyReport?: SafetyReport;
  warningEntities?: Entity[];
};

export type FlightConflict = {
  flight1Id: number;
  flight2Id: number;
  conflictPoints: Array<{
    lat: number;
    lon: number;
    altitude: number;
    time: Date;
  }>;
}

