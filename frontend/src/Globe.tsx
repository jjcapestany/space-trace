import { useEffect, useRef } from "react";
import { Ion, Viewer, Terrain, Cartesian3, Color, LabelStyle, VerticalOrigin, Cartesian2, HeadingPitchRange, Math as CesiumMath, createOsmBuildingsAsync } from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";
Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmZTkyYmQ4MS0wM2MwLTQ0YzYtYTc0MS1kYjQwNjZjODRjOWUiLCJpZCI6MzQ3MjI0LCJpYXQiOjE3NTk2MDA2MTB9.wiksTWk3Mhnj7FRgME5pKyowzjZwDtYKSruNoxrDIHc";

export const Globe = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const issEntityRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const viewer = new Viewer(containerRef.current, {
            terrain: Terrain.fromWorldTerrain(),
        });

        viewerRef.current = viewer;

        (async () => {
            const buildingTileset = await createOsmBuildingsAsync();
            viewer.scene.primitives.add(buildingTileset);
        })();

        loadISS();

        return () => {
            viewer.destroy();
        };
    }, []);

    const calculateISSPosition = (data: any) => {
        const tle1 = data.TLE_LINE_1;
        const tle2 = data.TLE_LINE_2;

        // Extract basic orbital elements from TLE
        const inclination = parseFloat(tle2.substring(8, 16));
        const raan = parseFloat(tle2.substring(17, 25));
        const meanMotion = parseFloat(tle2.substring(52, 63));

        // Calculate approximate position (this is very simplified!)
        const now = new Date();
        const minutesSinceEpoch = now.getMinutes() + now.getHours() * 60;
        const angle = (minutesSinceEpoch * meanMotion / 60) % 360;

        // Approximate latitude and longitude
        const lat = Math.sin(inclination * Math.PI / 180) * Math.sin(angle * Math.PI / 180) * 51.6;
        const lon = (angle + (minutesSinceEpoch * 0.25)) % 360 - 180;
        const altitude = 420000; // ISS altitude approximately 420 km

        return { lat, lon, altitude };
    };

    const addISSToGlobe = (data: any, position: any) => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // Remove existing ISS entity if present
        if (issEntityRef.current) {
            viewer.entities.remove(issEntityRef.current);
        }

        // Add ISS to the globe
        const issEntity = viewer.entities.add({
            name: 'ISS',
            position: Cartesian3.fromDegrees(
                position.lon,
                position.lat,
                position.altitude
            ),
            point: {
                pixelSize: 15,
                color: Color.YELLOW,
                outlineColor: Color.WHITE,
                outlineWidth: 3
            },
            label: {
                text: 'ISS (International Space Station)',
                font: '16px sans-serif',
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -20)
            },
            description: `
                <div style="font-family: Arial, sans-serif; padding: 10px;">
                    <h3 style="margin-top: 0; color: #333;">${data.OBJECT_NAME}</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 5px; font-weight: bold;">NORAD ID:</td>
                            <td style="padding: 5px;">${data.NORAD_CAT_ID}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 5px; font-weight: bold;">Country:</td>
                            <td style="padding: 5px;">${data.COUNTRY_CODE || 'International'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 5px; font-weight: bold;">Latitude:</td>
                            <td style="padding: 5px;">${position.lat.toFixed(4)}°</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 5px; font-weight: bold;">Longitude:</td>
                            <td style="padding: 5px;">${position.lon.toFixed(4)}°</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; font-weight: bold;">Altitude:</td>
                            <td style="padding: 5px;">${(position.altitude / 1000).toFixed(2)} km</td>
                        </tr>
                    </table>
                    <p style="margin-top: 10px; font-size: 12px; color: #666;">
                        <i>Note: Position is approximate for testing purposes</i>
                    </p>
                </div>
            `
        });

        issEntityRef.current = issEntity;

        // Fly camera to ISS
        viewer.flyTo(issEntity, {
            duration: 2,
            offset: new HeadingPitchRange(
                0,
                CesiumMath.toRadians(-45),
                5000000
            )
        });
    };

    const loadISS = async () => {
        try {
            console.log('Fetching ISS data...');
            const response = await fetch('https://api.keeptrack.space/v2/sat/25544');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('ISS data received:', data);

            const location = calculateISSPosition(data);
            console.log('Calculated position:', location);

            addISSToGlobe(data, location);

        } catch (error) {
            console.error('Error loading ISS:', error);
        }
    };

    return <div ref={containerRef} className={'w-full h-full'} />;
};

