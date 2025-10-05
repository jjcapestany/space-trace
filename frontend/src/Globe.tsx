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
import RegistrationPanel, {
  RegistrationInformationType as BaseRegistrationInfo,
} from "./RegistrationPanel/RegistrationPanel";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Stack } from "@mui/material";
import { getRegisteredFlights, registerFlight } from "./RegistrationPanel/client/flightRegistrationClient";
import { Alert, Snackbar } from "@mui/material";

// Simple token for demo purposes
Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmZTkyYmQ4MS0wM2MwLTQ0YzYtYTc0MS1kYjQwNjZjODRjOWUiLCJpZCI6MzQ3MjI0LCJpYXQiOjE3NTk2MDA2MTB9.wiksTWk3Mhnj7FRgME5pKyowzjZwDtYKSruNoxrDIHc";

// Extended interface for internal use with visibility and entities
interface ExtendedRegistrationInfo extends BaseRegistrationInfo {
  visible: boolean;
  entities: Entity[];
}

export const Globe = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const issEntityRef = useRef<Entity | null>(null);
  const leoSatellitesRef = useRef<Array<{ entity: Entity; satrec: any }>>([]);
  const [leoVisible, setLeoVisible] = useState(true);
  const [leoCount, setLeoCount] = useState(0);
  const [issLoaded, setIssLoaded] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [registeredFlights, setRegisteredFlights] = useState<
    ExtendedRegistrationInfo[]
  >([]);
  const [nextFlightId, setNextFlightId] = useState(1);

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

    // Load registered flights from backend
    getRegisteredFlights().then((flights) => {
      const extendedFlights: ExtendedRegistrationInfo[] = flights.map(flight => {
        const extended: ExtendedRegistrationInfo = {
          ...flight,
          launchDateAndTime: new Date(flight.launchDateAndTime),
          landingDateAndTime: new Date(flight.landingDateAndTime),
          visible: true,
          entities: []
        };

        extended.entities = createFlightPathForRegistration(extended);
        return extended;
      });
      setRegisteredFlights(extendedFlights);
    }).catch((error) => {
      console.error('Error loading registered flights:', error);
      setSnackbarMessage('Failed to load registered flights');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    });

    // Animation loop for real-time satellite updates
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

  // ISS LOGIC
  const calculatePositionFromSatrec = (satrec: any) => {
    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);
    const gmst = satellite.gstime(now);

    if (typeof positionAndVelocity.position === 'boolean') {
      throw new Error('Invalid satellite position');
    }

    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

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
    // Update ISS
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

    // Store satrec for real-time updates
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

      console.log("Total satellites:", data.length);

      // Filter for LEO satellites using mean motion from TLE
      const leoSatellites = data.filter((sat: any) => {
        if (!sat.tle2) return false;

        try {
          // Mean motion is in columns 52-63 of TLE line 2 (revolutions per day)
          const meanMotion = parseFloat(sat.tle2.substring(52, 63).trim());

          // LEO satellites typically have mean motion > 11 revolutions/day
          // Higher mean motion = lower, faster orbit
          return !isNaN(meanMotion) && meanMotion > 11;
        } catch (e) {
          return false;
        }
      });

      console.log(
        `Found ${leoSatellites.length} LEO satellites out of ${data.length} total`
      );
      

      // Add each LEO satellite to the globe
      leoSatellites.forEach((sat: any) => {
        try {
          if (!sat.tle1 || !sat.tle2) return;

          const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
          const position = calculatePositionFromSatrec(satrec);

          const entity = viewer.entities.add({
  name: sat.name || "Unknown Satellite",
  position: Cartesian3.fromDegrees(position.lon, position.lat, position.altitude),
  point: {
    pixelSize: 3,
    color: Color.fromAlpha(Color.CYAN, 0.7),
    outlineColor: Color.fromAlpha(Color.WHITE, 0.3),
    outlineWidth: 1,
  },
});



          // Store the entity and satrec for updates
          entity.show = leoVisible;

leoSatellitesRef.current.push({ entity, satrec });
        } catch (e) {
          // Skip satellites that can't be positioned
          console.debug("Could not position satellite:", sat.name);
        }
      });

      setLeoCount(leoSatellitesRef.current.length);

      console.log(`Added ${leoSatellitesRef.current.length} LEO satellites to the globe`);
      return leoSatellites;
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

      // Interpolate position
      const lat = startLat + (endLat - startLat) * fraction;
      const lon = startLon + (endLon - startLon) * fraction;

      // Parabolic altitude profile
      const altitude = maxAltitudeMeters * Math.sin(fraction * Math.PI);

      points.push({ lat, lon, altitude });
    }

    return points;
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

    // Flight path line
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

    // Launch marker
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

    // Apogee marker
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

    // Landing marker
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
    data: Omit<BaseRegistrationInfo, "id">
  ) => {
    const registeredFlight = await registerFlight(data);
    console.log("Flight registered successfully:", registeredFlight);
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

    // Fly camera to view the new flight
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
          <div className="mb-4 pb-4 border-b border-gray-700">
  <h4 className="text-lg font-semibold mb-2 text-white">
    LEO Satellites {leoCount ? `(${leoCount})` : ""}
  </h4>
  <div className="flex gap-1">
    <button
      onClick={() => applyLeoVisibility(!leoVisible)}
      className="w-full bg-gray-500 hover:bg-gray-700 px-2 py-2 rounded text-sm flex items-center justify-center gap-2"
    >
      {leoVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
      <span>{leoVisible ? "Hide LEO Satellites" : "Show LEO Satellites"}</span>
    </button>
  </div>
</div>

          <div>
            <h4 className="text-sm font-semibold mb-2 text-white-400">
              Camera
            </h4>
            <button
              onClick={resetCamera}
              className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
            >
              Reset Camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};