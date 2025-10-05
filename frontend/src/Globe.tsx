import { useEffect, useRef, useState } from "react";
import {
  Ion,
  Viewer,
  Terrain,
  Cartesian3,
  Color,
  LabelStyle,
  VerticalOrigin,
  Cartesian2,
  Math as CesiumMath,
  createOsmBuildingsAsync,
  PolylineGlowMaterialProperty,
  Entity,
} from "cesium";
import * as satellite from "satellite.js";
import "cesium/Build/Cesium/Widgets/widgets.css";
import RegistrationPanel from "./RegistrationPanel/RegistrationPanel";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  getRegisteredFlights,
  registerFlight,
} from "./RegistrationPanel/client/flightRegistrationClient";
import { Alert, Snackbar } from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import type { ExtendedRegistrationInfo, FlightConflict, SafetyReport, CollisionWarning, RegistrationInformationType  } from "./types/types";

Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmZTkyYmQ4MS0wM2MwLTQ0YzYtYTc0MS1kYjQwNjZjODRjOWUiLCJpZCI6MzQ3MjI0LCJpYXQiOjE3NTk2MDA2MTB9.wiksTWk3Mhnj7FRgME5pKyowzjZwDtYKSruNoxrDIHc";

export const Globe = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const issEntityRef = useRef<Entity | null>(null);
  const leoSatellitesRef = useRef<
    Array<{ entity: Entity; satrec: any; name: string }>
  >([]);
  const [leoVisible, setLeoVisible] = useState(true);
  const [leoCount, setLeoCount] = useState(0);
  const [issLoaded, setIssLoaded] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [registeredFlights, setRegisteredFlights] = useState<
    ExtendedRegistrationInfo[]
  >([]);
  const [conflicts, setConflicts] = useState<FlightConflict[]>([]);
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(
    null
  );
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [checkingFlightId, setCheckingFlightId] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );

  const applyLeoVisibility = (show: boolean) => {
    leoSatellitesRef.current.forEach(({ entity }) => {
      entity.show = show;
    });
    setLeoVisible(show);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#dc2626";
      case "danger":
        return "#ea580c";
      case "warning":
        return "#f59e0b";
      default:
        return "#10b981";
    }
  };

  // Main viewer setup
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Viewer(containerRef.current, {
      terrain: Terrain.fromWorldTerrain(),
      shouldAnimate: true,
    });
    viewerRef.current = viewer;

    let cancelled = false;

    (async () => {
      try {
        const tileset = await createOsmBuildingsAsync();
        if (!cancelled) viewer.scene.primitives.add(tileset);
      } catch (e) {
        console.error("Error loading OSM buildings:", e);
      }
    })();

    loadISS();
    loadLEOSatellites();

    getRegisteredFlights()
      .then((flights) => {
        const extendedFlights: ExtendedRegistrationInfo[] = flights.map(
          (flight) => {
            const extended: ExtendedRegistrationInfo = {
              ...flight,
              launchDateAndTime: new Date(flight.launchDateAndTime),
              landingDateAndTime: new Date(flight.landingDateAndTime),
              visible: true,
              entities: [],
            };

            extended.entities = createFlightPathForRegistration(extended);
            return extended;
          }
        );
        setRegisteredFlights(extendedFlights);
      })
      .catch((error) => {
        console.error("Error loading registered flights:", error);
        setSnackbarMessage("Failed to load registered flights");
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      });

    const animationInterval = setInterval(() => {
      if (cancelled) return;
      updateSatellitePositions();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(animationInterval);
      try {
        viewer.destroy();
      } catch (e) {
        console.warn("Viewer already destroyed:", e);
      }
    };
  }, []);

  // Conflict detection
  useEffect(() => {
    const detectedConflicts = detectConflicts(registeredFlights);
    setConflicts(detectedConflicts);
    visualizeConflicts(detectedConflicts);
  }, [registeredFlights]);

  const calculate3DDistance = (
    pos1: { lat: number; lon: number; altitude: number },
    pos2: { lat: number; lon: number; altitude: number }
  ): number => {
    const R = 6371;

    const lat1Rad = CesiumMath.toRadians(pos1.lat);
    const lat2Rad = CesiumMath.toRadians(pos2.lat);
    const dLat = CesiumMath.toRadians(pos2.lat - pos1.lat);
    const dLon = CesiumMath.toRadians(pos2.lon - pos1.lon);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const horizontalDist = R * c;

    const altDiff = (pos2.altitude - pos1.altitude) / 1000;

    return Math.sqrt(horizontalDist * horizontalDist + altDiff * altDiff);
  };

  const getFlightBoundingBox = (flight: ExtendedRegistrationInfo) => {
    const buffer = 200;

    const minLat = Math.min(flight.startingLatitude, flight.endingLatitude) - 2;
    const maxLat = Math.max(flight.startingLatitude, flight.endingLatitude) + 2;
    const minLon =
      Math.min(flight.startingLongitude, flight.endingLongitude) - 2;
    const maxLon =
      Math.max(flight.startingLongitude, flight.endingLongitude) + 2;
    const minAlt = 0;
    const maxAlt = flight.maxAltitude * 1000 + buffer * 1000;

    return { minLat, maxLat, minLon, maxLon, minAlt, maxAlt };
  };

  const filterSatellitesInProximity = (
    flight: ExtendedRegistrationInfo,
    launchTime: Date
  ): Array<{ satrec: any; name: string }> => {
    const bbox = getFlightBoundingBox(flight);
    const proximateSatellites: Array<{ satrec: any; name: string }> = [];

    leoSatellitesRef.current.forEach(({ satrec, name }) => {
      try {
        const positionAndVelocity = satellite.propagate(satrec, launchTime);
        const gmst = satellite.gstime(launchTime);

        if (typeof positionAndVelocity.position === "boolean") return;

        const positionGd = satellite.eciToGeodetic(
          positionAndVelocity.position,
          gmst
        );
        const lat = satellite.degreesLat(positionGd.latitude);
        const lon = satellite.degreesLong(positionGd.longitude);
        const altitude = positionGd.height * 1000;

        if (
          lat >= bbox.minLat &&
          lat <= bbox.maxLat &&
          lon >= bbox.minLon &&
          lon <= bbox.maxLon &&
          altitude >= bbox.minAlt &&
          altitude <= bbox.maxAlt
        ) {
          proximateSatellites.push({ satrec, name });
        }
      } catch (e) {
        // Ignore errors for individual satellites
      }
    });

    return proximateSatellites;
  };

  const calculatePositionAtTime = (satrec: any, time: Date) => {
    const positionAndVelocity = satellite.propagate(satrec, time);
    const gmst = satellite.gstime(time);

    if (typeof positionAndVelocity.position === "boolean") {
      throw new Error("Invalid satellite position");
    }

    const positionGd = satellite.eciToGeodetic(
      positionAndVelocity.position,
      gmst
    );

    return {
      lat: satellite.degreesLat(positionGd.latitude),
      lon: satellite.degreesLong(positionGd.longitude),
      altitude: positionGd.height * 1000,
    };
  };

  const analyzeFlightSafety = (
    flight: ExtendedRegistrationInfo
  ): SafetyReport => {
    const warnings: CollisionWarning[] = [];
    const launchTime = flight.launchDateAndTime;
    const landingTime = flight.landingDateAndTime;
    const durationSeconds =
      (landingTime.getTime() - launchTime.getTime()) / 1000;

    const numSamples = 100;
    const trajectory = calculateTrajectoryPoints(
      flight.startingLatitude,
      flight.startingLongitude,
      flight.endingLatitude,
      flight.endingLongitude,
      flight.maxAltitude,
      durationSeconds,
      numSamples
    );

    const proximateSatellites = filterSatellitesInProximity(flight, launchTime);
    console.log(
      `Checking ${proximateSatellites.length} satellites for flight ${flight.flightName}`
    );

    proximateSatellites.forEach(({ satrec, name }) => {
      let closestDistance = Infinity;
      let closestApproach: CollisionWarning | null = null;

      trajectory.forEach((flightPoint, index) => {
        const fraction = index / (numSamples - 1);
        const timeAtPoint = new Date(
          launchTime.getTime() + durationSeconds * fraction * 1000
        );

        try {
          const satPosition = calculatePositionAtTime(satrec, timeAtPoint);
          const distance = calculate3DDistance(flightPoint, satPosition);

          if (distance < closestDistance) {
            closestDistance = distance;

            let severity: "safe" | "warning" | "danger" | "critical";
            if (distance < 1) severity = "critical";
            else if (distance < 5) severity = "danger";
            else if (distance < 100) severity = "warning";
            else severity = "safe";

            closestApproach = {
              satelliteName: name,
              closestDistance: distance,
              timeOfClosestApproach: timeAtPoint,
              flightPosition: flightPoint,
              satellitePosition: satPosition,
              severity,
            };
          }
        } catch (e) {}
      });

      if (closestApproach && closestDistance < 100) {
        warnings.push(closestApproach);
      }
    });

    warnings.sort((a, b) => {
      const severityOrder = { critical: 0, danger: 1, warning: 2, safe: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.closestDistance - b.closestDistance;
    });

    let overallStatus: "safe" | "warning" | "danger" = "safe";
    if (
      warnings.some((w) => w.severity === "critical" || w.severity === "danger")
    ) {
      overallStatus = "danger";
    } else if (warnings.some((w) => w.severity === "warning")) {
      overallStatus = "warning";
    }

    return {
      flightId: flight.id,
      flightName: flight.flightName,
      totalSatellitesChecked: proximateSatellites.length,
      conflictsFound: warnings.length,
      warnings: warnings.slice(0, 20),
      overallStatus,
    };
  };

  const visualizeCollisionWarnings = (
    flight: ExtendedRegistrationInfo,
    report: SafetyReport
  ) => {
    const viewer = viewerRef.current;
    if (!viewer) return [];

    const warningEntities: Entity[] = [];

    report.warnings.forEach((warning) => {
      let markerColor: Color;
      switch (warning.severity) {
        case "critical":
          markerColor = Color.RED;
          break;
        case "danger":
          markerColor = Color.ORANGE;
          break;
        case "warning":
          markerColor = Color.YELLOW;
          break;
        default:
          markerColor = Color.GREEN;
      }

      const entity = viewer.entities.add({
        name: `Collision Warning - ${warning.satelliteName}`,
        position: Cartesian3.fromDegrees(
          warning.flightPosition.lon,
          warning.flightPosition.lat,
          warning.flightPosition.altitude
        ),
        point: {
          pixelSize: 8,
          color: markerColor,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `⚠️ ${warning.closestDistance.toFixed(1)}km`,
          font: "11px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -10),
          show: true,
        },
      });

      warningEntities.push(entity);
    });

    return warningEntities;
  };

  const handleCheckSafety = (flightId: number) => {
    const flight = registeredFlights.find((f) => f.id === flightId);
    if (!flight) return;

    setCheckingFlightId(flightId);

    setTimeout(() => {
      const report = analyzeFlightSafety(flight);

      if (flight.warningEntities) {
        flight.warningEntities.forEach((entity) => {
          viewerRef.current?.entities.remove(entity);
        });
      }

      const warningEntities = visualizeCollisionWarnings(flight, report);

      setRegisteredFlights((prev) =>
        prev.map((f) =>
          f.id === flightId
            ? { ...f, safetyReport: report, warningEntities }
            : f
        )
      );

      setSelectedReport(report);
      setReportDialogOpen(true);
      setCheckingFlightId(null);
    }, 100);
  };

  // SATELLITE POSITION FUNCTIONS
  const calculatePositionFromSatrec = (satrec: any) => {
    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);
    const gmst = satellite.gstime(now);

    if (typeof positionAndVelocity.position === "boolean") {
      throw new Error("Invalid satellite position");
    }

    const positionGd = satellite.eciToGeodetic(
      positionAndVelocity.position,
      gmst
    );

    const lat = satellite.degreesLat(positionGd.latitude);
    const lon = satellite.degreesLong(positionGd.longitude);
    const altitude = positionGd.height * 1000;
    return { lat, lon, altitude };
  };

  const calculateISSPosition = (tle1: string, tle2: string) => {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    return calculatePositionFromSatrec(satrec);
  };

  const updateSatellitePositions = () => {
    if (issEntityRef.current) {
      const issEntity = issEntityRef.current as any;
      if (issEntity.satrec) {
        const position = calculatePositionFromSatrec(issEntity.satrec);
        issEntity.position = Cartesian3.fromDegrees(
          position.lon,
          position.lat,
          position.altitude
        );
      }
    }

    if (leoVisible) {
      leoSatellitesRef.current.forEach(({ entity, satrec }) => {
        try {
          const position = calculatePositionFromSatrec(satrec);
          (entity as any).position = Cartesian3.fromDegrees(
            position.lon,
            position.lat,
            position.altitude
          );
        } catch {}
      });
    }
  };

  const addISSToGlobe = (
    data: any,
    position: { lat: number; lon: number; altitude: number }
  ) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (issEntityRef.current) {
      viewer.entities.remove(issEntityRef.current);
    }

    const satrec = satellite.twoline2satrec(data.TLE_LINE_1, data.TLE_LINE_2);

    const issEntity = viewer.entities.add({
      name: "ISS",
      position: Cartesian3.fromDegrees(
        position.lon,
        position.lat,
        position.altitude
      ),
      point: {
        pixelSize: 15,
        color: Color.YELLOW,
        outlineColor: Color.WHITE,
        outlineWidth: 3,
      },
      label: {
        text: "ISS",
        font: "14px sans-serif",
        fillColor: Color.YELLOW,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -20),
      },
    }) as any;

    issEntity.satrec = satrec;
    issEntityRef.current = issEntity;
    setIssLoaded(true);
  };

  const loadISS = async () => {
    try {
      const response = await fetch("https://api.keeptrack.space/v2/sat/25544");
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      const pos = calculateISSPosition(data.TLE_LINE_1, data.TLE_LINE_2);
      addISSToGlobe(data, pos);
    } catch (e) {
      console.error("Error loading ISS:", e);
    }
  };

  const loadLEOSatellites = async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      const response = await fetch("https://api.keeptrack.space/v2/sats");
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();

      const leoSatellites = data.filter((sat: any) => {
        if (!sat.tle2) return false;

        try {
          const meanMotion = parseFloat(sat.tle2.substring(52, 63).trim());
          return !isNaN(meanMotion) && meanMotion > 11;
        } catch (e) {
          return false;
        }
      });

      leoSatellites.forEach((sat: any) => {
        try {
          if (!sat.tle1 || !sat.tle2) return;

          const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
          const position = calculatePositionFromSatrec(satrec);

          const entity = viewer.entities.add({
            name: sat.name || "Unknown Satellite",
            position: Cartesian3.fromDegrees(
              position.lon,
              position.lat,
              position.altitude
            ),
            point: {
              pixelSize: 3,
              color: Color.fromAlpha(Color.CYAN, 0.7),
              outlineColor: Color.fromAlpha(Color.WHITE, 0.3),
              outlineWidth: 1,
            },
          });

          entity.show = leoVisible;

          leoSatellitesRef.current.push({
            entity,
            satrec,
            name: sat.name || "Unknown",
          });
        } catch (e) {
          console.debug("Could not position satellite:", sat.name);
        }
      });

      setLeoCount(leoSatellitesRef.current.length);
      console.log(
        `Added ${leoSatellitesRef.current.length} LEO satellites to the globe`
      );
    } catch (e) {
      console.error("Error loading sats:", e);
    }
  };

  // FLIGHT PATH CALCULATION
  const calculateTrajectoryPoints = (
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    maxAltitudeKm: number,
    durationSeconds: number,
    numPoints = 200
  ) => {
    const points: Array<{ lat: number; lon: number; altitude: number }> = [];
    const maxAltitudeMeters = maxAltitudeKm * 1000;

    for (let i = 0; i < numPoints; i++) {
      const fraction = i / (numPoints - 1);
      const lat = startLat + (endLat - startLat) * fraction;
      const lon = startLon + (endLon - startLon) * fraction;
      const altitude = maxAltitudeMeters * Math.sin(fraction * Math.PI);

      points.push({ lat, lon, altitude });
    }

    return points;
  };

  const calculateTrajectoryPointsWithTime = (
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    maxAltitudeKm: number,
    launchTime: Date,
    landingTime: Date,
    numPoints = 200
  ): Array<{ lat: number; lon: number; altitude: number; time: Date }> => {
    const points: Array<{
      lat: number;
      lon: number;
      altitude: number;
      time: Date;
    }> = [];
    const totalDurationMs = landingTime.getTime() - launchTime.getTime();
    const maxAltitudeMeters = maxAltitudeKm * 1000;

    for (let i = 0; i < numPoints; i++) {
      const fraction = i / (numPoints - 1);
      const currentTime = new Date(
        launchTime.getTime() + fraction * totalDurationMs
      );

      const lat = startLat + (endLat - startLat) * fraction;
      const lon = startLon + (endLon - startLon) * fraction;
      const altitude = maxAltitudeMeters * Math.sin(fraction * Math.PI);

      points.push({ lat, lon, altitude, time: currentTime });
    }

    return points;
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    alt1: number,
    lat2: number,
    lon2: number,
    alt2: number
  ): number => {
    const R = 6371;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const horizontalDistance = R * c;

    const verticalDistance = Math.abs(alt1 - alt2) / 1000;

    return Math.sqrt(
      horizontalDistance * horizontalDistance +
        verticalDistance * verticalDistance
    );
  };

  const findConflictPoints = (
    flight1: ExtendedRegistrationInfo,
    flight2: ExtendedRegistrationInfo,
    safeDistanceKm: number,
    timeToleranceSeconds: number
  ): Array<{ lat: number; lon: number; altitude: number; time: Date }> => {
    const conflictPoints: Array<{
      lat: number;
      lon: number;
      altitude: number;
      time: Date;
    }> = [];

    const trajectory1 = calculateTrajectoryPointsWithTime(
      flight1.startingLatitude,
      flight1.startingLongitude,
      flight1.endingLatitude,
      flight1.endingLongitude,
      flight1.maxAltitude,
      flight1.launchDateAndTime,
      flight1.landingDateAndTime,
      100
    );

    const trajectory2 = calculateTrajectoryPointsWithTime(
      flight2.startingLatitude,
      flight2.startingLongitude,
      flight2.endingLatitude,
      flight2.endingLongitude,
      flight2.maxAltitude,
      flight2.launchDateAndTime,
      flight2.landingDateAndTime,
      100
    );

    for (const pos1 of trajectory1) {
      for (const pos2 of trajectory2) {
        const timeDiff =
          Math.abs(pos1.time.getTime() - pos2.time.getTime()) / 1000;
        if (timeDiff > timeToleranceSeconds) continue;

        const distance = calculateDistance(
          pos1.lat,
          pos1.lon,
          pos1.altitude,
          pos2.lat,
          pos2.lon,
          pos2.altitude
        );

        if (distance < safeDistanceKm) {
          conflictPoints.push({
            lat: (pos1.lat + pos2.lat) / 2,
            lon: (pos1.lon + pos2.lon) / 2,
            altitude: (pos1.altitude + pos2.altitude) / 2,
            time: pos1.time,
          });
          break;
        }
      }
    }

    return conflictPoints;
  };

  const detectConflicts = (
    flights: ExtendedRegistrationInfo[]
  ): FlightConflict[] => {
    const SAFE_DISTANCE_KM = 10;
    const TIME_TOLERANCE_SECONDS = 60;
    const conflicts: FlightConflict[] = [];

    const visibleFlights = flights.filter((f) => f.visible);

    for (let i = 0; i < visibleFlights.length; i++) {
      for (let j = i + 1; j < visibleFlights.length; j++) {
        const flight1 = visibleFlights[i];
        const flight2 = visibleFlights[j];

        const conflictPoints = findConflictPoints(
          flight1,
          flight2,
          SAFE_DISTANCE_KM,
          TIME_TOLERANCE_SECONDS
        );

        if (conflictPoints.length > 0) {
          conflicts.push({
            flight1Id: flight1.id,
            flight2Id: flight2.id,
            conflictPoints,
          });
        }
      }
    }

    return conflicts;
  };

  const visualizeConflicts = (conflicts: FlightConflict[]) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const existingConflicts = viewer.entities.values.filter(
      (e) => e.name && e.name.includes("CONFLICT")
    );
    existingConflicts.forEach((e) => viewer.entities.remove(e));

    conflicts.forEach((conflict, idx) => {
      conflict.conflictPoints.forEach((point, pointIdx) => {
        viewer.entities.add({
          name: `CONFLICT-${idx}-${pointIdx}`,
          position: Cartesian3.fromDegrees(
            point.lon,
            point.lat,
            point.altitude
          ),
          point: {
            pixelSize: 20,
            color: Color.RED.withAlpha(0.8),
            outlineColor: Color.YELLOW,
            outlineWidth: 3,
          },
          label: {
            text: "⚠️ CONFLICT",
            font: "14px sans-serif",
            fillColor: Color.RED,
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -25),
          },
        });
      });
    });
  };

  const createFlightPathForRegistration = (
    flight: ExtendedRegistrationInfo
  ): Entity[] => {
    const viewer = viewerRef.current;
    if (!viewer) return [];

    const durationSeconds =
      (flight.landingDateAndTime.getTime() -
        flight.launchDateAndTime.getTime()) /
      1000;
    const trajectory = calculateTrajectoryPoints(
      flight.startingLatitude,
      flight.startingLongitude,
      flight.endingLatitude,
      flight.endingLongitude,
      flight.maxAltitude,
      durationSeconds
    );

    const entities: Entity[] = [];
    const positions = trajectory.map((p) =>
      Cartesian3.fromDegrees(p.lon, p.lat, p.altitude)
    );

    const colors = [
      Color.CYAN,
      Color.MAGENTA,
      Color.LIME,
      Color.ORANGE,
      Color.PINK,
    ];
    const flightColor = colors[flight.id % colors.length];

    const path = viewer.entities.add({
      name: `${flight.flightName} - Path`,
      polyline: {
        positions,
        width: 4,
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: flightColor,
        }),
        clampToGround: false,
      },
    });
    entities.push(path);

    const launchEntity = viewer.entities.add({
      name: `${flight.flightName} - Launch`,
      position: Cartesian3.fromDegrees(
        flight.startingLongitude,
        flight.startingLatitude,
        0
      ),
      point: {
        pixelSize: 12,
        color: Color.RED,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: `🚀 ${flight.flightName}`,
        font: "12px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.TOP,
        pixelOffset: new Cartesian2(0, 12),
      },
    });
    entities.push(launchEntity);

    const apogee = trajectory[Math.floor(trajectory.length / 2)];
    const apogeeEntity = viewer.entities.add({
      name: `${flight.flightName} - Apogee`,
      position: Cartesian3.fromDegrees(apogee.lon, apogee.lat, apogee.altitude),
      point: {
        pixelSize: 10,
        color: flightColor,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: `${flight.maxAltitude} km`,
        font: "12px sans-serif",
        fillColor: flightColor,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -12),
      },
    });
    entities.push(apogeeEntity);

    const landing = trajectory[trajectory.length - 1];
    const landingEntity = viewer.entities.add({
      name: `${flight.flightName} - Landing`,
      position: Cartesian3.fromDegrees(landing.lon, landing.lat, 0),
      point: {
        pixelSize: 12,
        color: Color.ORANGE,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: "🪂 Landing",
        font: "12px sans-serif",
        fillColor: Color.ORANGE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.TOP,
        pixelOffset: new Cartesian2(0, 12),
      },
    });
    entities.push(landingEntity);

    return entities;
  };

  const handleRegistrationSubmit = async (
    data: Omit<RegistrationInformationType, "id">
  ) => {
    const registeredFlight = await registerFlight(data);
    setSnackbarMessage("Flight successfully registered!");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
    setIsPanelOpen(false);

    const newFlight: ExtendedRegistrationInfo = {
      ...registeredFlight,
      launchDateAndTime: new Date(registeredFlight.launchDateAndTime),
      landingDateAndTime: new Date(registeredFlight.landingDateAndTime),
      visible: true,
      entities: [],
    };

    const entities = createFlightPathForRegistration(newFlight);
    newFlight.entities = entities;

    setRegisteredFlights((prev) => [...prev, newFlight]);

    if (viewerRef.current) {
      const midLat = (data.startingLatitude + data.endingLatitude) / 2;
      const midLon = (data.startingLongitude + data.endingLongitude) / 2;
      viewerRef.current.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          midLon,
          midLat,
          data.maxAltitude * 2000
        ),
        duration: 2,
      });
    }
  };

  const toggleFlightVisibility = (flightId: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setRegisteredFlights((prev) =>
      prev.map((flight) => {
        if (flight.id === flightId) {
          const newVisible = !flight.visible;
          flight.entities.forEach((entity) => {
            entity.show = newVisible;
          });
          // Also toggle warning entities
          if (flight.warningEntities) {
            flight.warningEntities.forEach((entity) => {
              entity.show = newVisible;
            });
          }
          return { ...flight, visible: newVisible };
        }
        return flight;
      })
    );
  };

  const deleteFlight = (flightId: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const flight = registeredFlights.find((f) => f.id === flightId);
    if (flight) {
      flight.entities.forEach((entity) => viewer.entities.remove(entity));
      // Also remove warning entities
      if (flight.warningEntities) {
        flight.warningEntities.forEach((entity) =>
          viewer.entities.remove(entity)
        );
      }
    }

    setRegisteredFlights((prev) => prev.filter((f) => f.id !== flightId));
  };

  const resetCamera = () => {
    const viewer = viewerRef.current;
    if (viewer) {
      viewer.trackedEntity = undefined;
      viewer.camera.flyHome(1);
    }
  };

  return (
    <div className="relative w-full h-screen flex">
      <div
        className={`h-full bg-gray-900 shadow-2xl transition-all duration-300 ease-in-out z-50 ${isPanelOpen ? "w-[30%]" : "w-0"} overflow-hidden`}
      >
        {isPanelOpen && (
          <RegistrationPanel
            open={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            onSubmit={handleRegistrationSubmit}
          />
        )}
      </div>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <div className="relative flex-1 h-full">
        <div ref={containerRef} className="w-full h-full" />

        <div className="absolute top-4 left-4 bg-opacity-50 text-white p-6 rounded-lg max-w-sm z-40">
          <Stack
            direction={"row"}
            gap={1}
            sx={{ backgroundColor: "black", p: 1, borderRadius: 2 }}
            className="mb-4"
          >
            <RocketLaunchIcon sx={{ color: "#bf60faff" }} />
            <h3 className="text-2xl font-bold">Space Trace</h3>
          </Stack>
          <div className="mb-4 pb-4 border-b border-gray-700">
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-semibold transition-colors"
            >
              {isPanelOpen ? "Close Registration" : "+ Register Flight"}
            </button>
          </div>
          {conflicts.length > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-700">
              <h4 className="text-lg font-semibold mb-2 text-red-400">
                ⚠️ Conflicts Detected ({conflicts.length})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {conflicts.map((conflict, idx) => {
                  const flight1 = registeredFlights.find(
                    (f) => f.id === conflict.flight1Id
                  );
                  const flight2 = registeredFlights.find(
                    (f) => f.id === conflict.flight2Id
                  );
                  return (
                    <div
                      key={idx}
                      className="bg-red-900 bg-opacity-30 p-2 rounded text-sm border border-red-500"
                    >
                      <div className="font-semibold text-red-300">
                        {flight1?.flightName} ↔ {flight2?.flightName}
                      </div>
                      <div className="text-xs text-red-400">
                        {conflict.conflictPoints.length} conflict point(s)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mb-4 pb-4 border-b border-gray-700">
            <h4 className="text-lg font-semibold mb-2 text-white">
              Registered Flights ({registeredFlights.length})
            </h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {registeredFlights.length === 0 ? (
                <div className="text-sm text-gray-400">
                  No flights registered
                </div>
              ) : (
                registeredFlights.map((flight) => (
                  <div
                    key={flight.id}
                    className="bg-gray-800 p-2 rounded text-sm"
                  >
                    <div className="font-semibold text-white mb-1">
                      {flight.flightName}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      Max Alt: {flight.maxAltitude} km |{" "}
                      {flight.modelOfSpaceCraft}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCheckSafety(flight.id)}
                        disabled={checkingFlightId === flight.id}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                      >
                        {checkingFlightId === flight.id ? (
                          "Checking..."
                        ) : flight.safetyReport ? (
                          flight.safetyReport.overallStatus === "safe" ? (
                            <CheckCircleIcon fontSize="small" />
                          ) : (
                            <WarningIcon fontSize="small" />
                          )
                        ) : (
                          "Check Safety"
                        )}
                      </button>
                      <button
                        onClick={() => toggleFlightVisibility(flight.id)}
                        className="flex-1 bg-gray-500 hover:bg-gray-700 px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                      >
                        {flight.visible ? (
                          <VisibilityIcon />
                        ) : (
                          <VisibilityOffIcon />
                        )}
                      </button>
                      <button
                        onClick={() => deleteFlight(flight.id)}
                        className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mb-4 pb-4 border-gray-700">
            <h4 className="text-lg font-semibold mb-2 text-white">
              LEO Satellites {leoCount ? `(${leoCount})` : ""}
            </h4>
            <div className="flex gap-1">
              <button
                onClick={() => applyLeoVisibility(!leoVisible)}
                className="w-full bg-gray-500 hover:bg-gray-700 px-2 py-2 rounded text-sm flex items-center justify-center gap-2"
              >
                {leoVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                <span>
                  {leoVisible ? "Hide LEO Satellites" : "Show LEO Satellites"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Safety Report: {selectedReport?.flightName}</DialogTitle>
        <DialogContent>
          {selectedReport && (
            <div>
              <div className="mb-4">
                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    style={{
                      color: getSeverityColor(selectedReport.overallStatus),
                    }}
                  >
                    {selectedReport.overallStatus.toUpperCase()}
                  </span>
                </p>
                <p>
                  <strong>Satellites Checked:</strong>{" "}
                  {selectedReport.totalSatellitesChecked}
                </p>
                <p>
                  <strong>Potential Conflicts:</strong>{" "}
                  {selectedReport.conflictsFound}
                </p>
              </div>

              {selectedReport.warnings.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2">Closest Approaches:</h4>
                  <div className="max-h-96 overflow-y-auto">
                    {selectedReport.warnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className="mb-3 p-3 bg-gray-100 rounded"
                        style={{
                          borderLeft: `4px solid ${getSeverityColor(warning.severity)}`,
                        }}
                      >
                        <p>
                          <strong>{warning.satelliteName}</strong>
                        </p>
                        <p>Distance: {warning.closestDistance.toFixed(2)} km</p>
                        <p>
                          Time: {warning.timeOfClosestApproach.toLocaleString()}
                        </p>
                        <p>
                          Severity:{" "}
                          <span
                            style={{
                              color: getSeverityColor(warning.severity),
                            }}
                          >
                            {warning.severity}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
