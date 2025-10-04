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
    PolylineGlowMaterialProperty
} from "cesium";
import * as satellite from "satellite.js";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Simple token for demo purposes
Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmZTkyYmQ4MS0wM2MwLTQ0YzYtYTc0MS1kYjQwNjZjODRjOWUiLCJpZCI6MzQ3MjI0LCJpYXQiOjE3NTk2MDA2MTB9.wiksTWk3Mhnj7FRgME5pKyowzjZwDtYKSruNoxrDIHc";

// Blue Origin Launch Site (West Texas)
const BLUE_ORIGIN_LAUNCH_SITE = {
    name: "Blue Origin Launch Site 1",
    lat: 31.422878,
    lon: -104.7575,
    altitude: 1400, // meters
};

interface FlightParameters {
    launchSite: { lat: number; lon: number; altitude: number; name: string };
    apogeeAltitude: number; // km
    flightDuration: number; // seconds
    launchAngle: number; // degrees
    azimuth: number; // degrees
}

export const Globe = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const issEntityRef = useRef<any>(null);
    const flightEntitiesRef = useRef<any[]>([]);
    const [issLoaded, setIssLoaded] = useState(false);
    const [flightLoaded, setFlightLoaded] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const viewer = new Viewer(containerRef.current, {
            terrain: Terrain.fromWorldTerrain(),
            shouldAnimate: true,
        });
        viewerRef.current = viewer;

        let cancelled = false;

        // Load OSM Buildings safely
        (async () => {
            try {
                const tileset = await createOsmBuildingsAsync();
                if (!cancelled) viewer.scene.primitives.add(tileset);
            } catch (e) {
                console.error("Error loading OSM buildings:", e);
            }
        })();

        // Load ISS on mount
        loadISS();

        return () => {
            cancelled = true;
            try {
                viewer.destroy();
            } catch (e) {
                console.warn("Viewer already destroyed:", e);
            }
        };
    }, []);

    // ===== ISS LOGIC =====

    const calculateISSPosition = (tle1: string, tle2: string) => {
        const satrec = satellite.twoline2satrec(tle1, tle2);
        const now = new Date();
        const positionAndVelocity = satellite.propagate(satrec, now);
        const gmst = satellite.gstime(now);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position!, gmst);

        const lat = satellite.degreesLat(positionGd.latitude);
        const lon = satellite.degreesLong(positionGd.longitude);
        const altitude = positionGd.height * 1000; // meters
        return { lat, lon, altitude };
    };

    const addISSToGlobe = (data: any, position: { lat: number; lon: number; altitude: number }) => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        if (issEntityRef.current) {
            viewer.entities.remove(issEntityRef.current);
        }

        const issEntity = viewer.entities.add({
            name: "ISS",
            position: Cartesian3.fromDegrees(position.lon, position.lat, position.altitude),
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
            description: `
                <div style="font-family: Arial, sans-serif; padding: 10px;">
                    <h3 style="margin-top: 0;">${data.OBJECT_NAME}</h3>
                    <table>
                        <tr><td><b>NORAD ID:</b></td><td>${data.NORAD_CAT_ID}</td></tr>
                        <tr><td><b>Latitude:</b></td><td>${position.lat.toFixed(4)}°</td></tr>
                        <tr><td><b>Longitude:</b></td><td>${position.lon.toFixed(4)}°</td></tr>
                        <tr><td><b>Altitude:</b></td><td>${(position.altitude / 1000).toFixed(2)} km</td></tr>
                    </table>
                </div>
            `,
        });

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

    // ===== BLUE ORIGIN LOGIC =====

    const calculateTrajectoryPoints = (params: FlightParameters, numPoints = 200) => {
        const points: Array<{ lat: number; lon: number; altitude: number }> = [];
        const { launchSite, apogeeAltitude, flightDuration, azimuth, launchAngle } = params;

        const halfDuration = flightDuration / 2;
        const apogeeMeters = apogeeAltitude * 1000;
        const earthRadius = 6371; // km

        for (let i = 0; i < numPoints; i++) {
            const t = (i / (numPoints - 1)) * flightDuration;

            // Altitude follows a simple parabolic arc
            let altitude: number;
            if (t <= halfDuration) {
                const f = t / halfDuration;
                altitude = apogeeMeters * (1 - Math.pow(1 - f, 2));
            } else {
                const f = (t - halfDuration) / halfDuration;
                altitude = apogeeMeters * (1 - Math.pow(f, 2));
            }
            altitude += launchSite.altitude;

            // Horizontal displacement — based on azimuth + launchAngle
            const totalHorizontalKm = (apogeeAltitude / Math.tan(launchAngle * Math.PI / 180)) / 5;
            const horizontalFraction = Math.sin((t / flightDuration) * Math.PI);
            const horizontalDistance = totalHorizontalKm * horizontalFraction;

            const latOffset =
                (horizontalDistance * Math.cos(azimuth * Math.PI / 180)) / earthRadius * (180 / Math.PI);
            const lonOffset =
                (horizontalDistance * Math.sin(azimuth * Math.PI / 180)) /
                (earthRadius * Math.cos(launchSite.lat * Math.PI / 180)) *
                (180 / Math.PI);

            points.push({
                lat: launchSite.lat + latOffset,
                lon: launchSite.lon + lonOffset,
                altitude,
            });
        }

        return points;
    };

    const createFlightPath = (params: FlightParameters) => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // Remove old entities first
        flightEntitiesRef.current.forEach(e => viewer.entities.remove(e));
        flightEntitiesRef.current = [];

        const trajectory = calculateTrajectoryPoints(params);
        const positions = trajectory.map(p => Cartesian3.fromDegrees(p.lon, p.lat, p.altitude));

        const path = viewer.entities.add({
            name: "Blue Origin Flight Path",
            polyline: {
                positions,
                width: 4,
                material: new PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Color.CYAN,
                }),
                clampToGround: false,
            },
        });
        flightEntitiesRef.current.push(path);

        // Launch marker
        const launchEntity = viewer.entities.add({
            name: "Launch",
            position: Cartesian3.fromDegrees(params.launchSite.lon, params.launchSite.lat, params.launchSite.altitude),
            point: { pixelSize: 12, color: Color.RED, outlineColor: Color.WHITE, outlineWidth: 2 },
            label: {
                text: "🚀 Launch",
                font: "12px sans-serif",
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.TOP,
                pixelOffset: new Cartesian2(0, 12),
            },
        });
        flightEntitiesRef.current.push(launchEntity);

        // Apogee marker
        const apogee = trajectory[Math.floor(trajectory.length / 2)];
        const apogeeEntity = viewer.entities.add({
            name: "Apogee",
            position: Cartesian3.fromDegrees(apogee.lon, apogee.lat, apogee.altitude),
            point: { pixelSize: 10, color: Color.LIME, outlineColor: Color.WHITE, outlineWidth: 2 },
            label: {
                text: `Apogee: ${params.apogeeAltitude} km`,
                font: "12px sans-serif",
                fillColor: Color.LIME,
                outlineColor: Color.BLACK,
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -12),
            },
        });
        flightEntitiesRef.current.push(apogeeEntity);

        // Landing marker (same as launch for Blue Origin)
        const landing = trajectory[trajectory.length - 1];
        const landingEntity = viewer.entities.add({
            name: "Landing",
            position: Cartesian3.fromDegrees(landing.lon, landing.lat, landing.altitude),
            point: { pixelSize: 12, color: Color.ORANGE, outlineColor: Color.WHITE, outlineWidth: 2 },
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
        flightEntitiesRef.current.push(landingEntity);

        // Fly camera to view the trajectory
        viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(params.launchSite.lon - 0.5, params.launchSite.lat, 300000),
            orientation: {
                heading: CesiumMath.toRadians(90),
                pitch: CesiumMath.toRadians(-20),
                roll: 0,
            },
            duration: 2,
        });

        setFlightLoaded(true);
    };

    const loadBlueOriginFlight = () => {
        createFlightPath({
            launchSite: BLUE_ORIGIN_LAUNCH_SITE,
            apogeeAltitude: 107,
            flightDuration: 660,
            launchAngle: 80,
            azimuth: 0,
        });
    };

    // ===== CONTROLS =====

    const trackISS = () => {
        const viewer = viewerRef.current;
        if (viewer && issEntityRef.current) {
            viewer.trackedEntity = issEntityRef.current;
        }
    };

    const resetCamera = () => {
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.trackedEntity = undefined;
            viewer.camera.flyHome(1);
        }
    };

    // ===== UI =====
    return (
        <div className="relative w-full h-screen">
            <div ref={containerRef} className="w-full h-full" />

            <div className="absolute top-4 left-4 bg-black bg-opacity-90 text-white p-6 rounded-lg max-w-sm z-40">
                <h3 className="text-2xl font-bold mb-4">🌍 Space Tracker</h3>

                {/* ISS Section */}
                <div className="mb-4 pb-4 border-b border-gray-700">
                    <h4 className="text-lg font-semibold mb-2 text-yellow-400">ISS Tracker</h4>
                    {issLoaded ? (
                        <div className="space-y-2">
                            <div className="text-sm text-green-400">✓ ISS Loaded</div>
                            <button onClick={trackISS} className="w-full bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded">
                                Track ISS
                            </button>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-400">Loading ISS...</div>
                    )}
                </div>

                {/* Blue Origin Section */}
                <div className="mb-4 pb-4 border-b border-gray-700">
                    <h4 className="text-lg font-semibold mb-2 text-cyan-400">Blue Origin Flight Path</h4>
                    {!flightLoaded ? (
                        <button onClick={loadBlueOriginFlight} className="w-full bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded">
                            Show Flight Path
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-sm text-green-400">✓ Flight Path Displayed</div>
                            <div className="text-xs text-gray-400 mt-2">
                                • 🚀 Red = Launch<br />
                                • 🟢 Green = Apogee<br />
                                • 🟠 Orange = Landing
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <h4 className="text-sm font-semibold mb-2 text-gray-400">Camera</h4>
                    <button onClick={resetCamera} className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                        Reset Camera
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-90 text-white px-4 py-3 rounded text-xs z-40">
                <div className="space-y-1">
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2" />
                        <span>ISS (Orbital)</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-cyan-400 mr-2" />
                        <span>Blue Origin (Suborbital)</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                        <span>Launch Site</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
