import { useState } from "react";
import {
    Ion,
    Math as CesiumMath,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
    Box,
    Typography,
    TextField,
    Button,
    IconButton,
    Divider,
    Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmZTkyYmQ4MS0wM2MwLTQ0YzYtYTc0MS1kYjQwNjZjODRjOWUiLCJpZCI6MzQ3MjI0LCJpYXQiOjE3NTk2MDA2MTB9.wiksTWk3Mhnj7FRgME5pKyowzjZwDtYKSruNoxrDIHc";

export interface RegistrationInformationType {
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

interface RegisteredFlight extends RegistrationInformationType {
    visible: boolean;
    entities: any[];
}

// Registration Panel Component
export default function RegistrationSidePanel({
    open,
    onClose,
    onSubmit,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<RegistrationInformationType, 'id'>) => void;
}) {
    const [formData, setFormData] = useState({
        flightName: '',
        startingLatitude: '',
        startingLongitude: '',
        endingLatitude: '',
        endingLongitude: '',
        launchDateAndTime: '',
        landingDateAndTime: '',
        maxAltitude: '',
        modelOfSpaceCraft: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [snackbarOpen, setSnackbarOpen] = useState(false);

    const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({
            ...prev,
            [field]: event.target.value,
        }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: '' }));
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.flightName.trim()) {
            newErrors.flightName = 'Flight name is required';
        }

        const startLat = parseFloat(formData.startingLatitude);
        if (isNaN(startLat) || startLat < -90 || startLat > 90) {
            newErrors.startingLatitude = 'Latitude must be between -90 and 90';
        }

        const startLng = parseFloat(formData.startingLongitude);
        if (isNaN(startLng) || startLng < -180 || startLng > 180) {
            newErrors.startingLongitude = 'Longitude must be between -180 and 180';
        }

        const endLat = parseFloat(formData.endingLatitude);
        if (isNaN(endLat) || endLat < -90 || endLat > 90) {
            newErrors.endingLatitude = 'Latitude must be between -90 and 90';
        }

        const endLng = parseFloat(formData.endingLongitude);
        if (isNaN(endLng) || endLng < -180 || endLng > 180) {
            newErrors.endingLongitude = 'Longitude must be between -180 and 180';
        }

        if (!formData.launchDateAndTime) {
            newErrors.launchDateAndTime = 'Launch date and time is required';
        }

        if (!formData.landingDateAndTime) {
            newErrors.landingDateAndTime = 'Landing date and time is required';
        }

        if (formData.launchDateAndTime && formData.landingDateAndTime) {
            const launchDate = new Date(formData.launchDateAndTime);
            const landingDate = new Date(formData.landingDateAndTime);
            if (landingDate <= launchDate) {
                newErrors.landingDateAndTime = 'Landing must be after launch';
            }
        }

        const alt = parseFloat(formData.maxAltitude);
        if (isNaN(alt) || alt <= 0) {
            newErrors.maxAltitude = 'Max altitude must be greater than 0';
        }

        if (!formData.modelOfSpaceCraft.trim()) {
            newErrors.modelOfSpaceCraft = 'Spacecraft model is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (validate()) {
            const submitData = {
                flightName: formData.flightName,
                startingLatitude: parseFloat(formData.startingLatitude),
                startingLongitude: parseFloat(formData.startingLongitude),
                endingLatitude: parseFloat(formData.endingLatitude),
                endingLongitude: parseFloat(formData.endingLongitude),
                launchDateAndTime: new Date(formData.launchDateAndTime),
                landingDateAndTime: new Date(formData.landingDateAndTime),
                maxAltitude: parseFloat(formData.maxAltitude),
                modelOfSpaceCraft: formData.modelOfSpaceCraft,
            };
            onSubmit(submitData);
            handleReset();
        }
    };

    const handleReset = () => {
        setFormData({
            flightName: '',
            startingLatitude: '',
            startingLongitude: '',
            endingLatitude: '',
            endingLongitude: '',
            launchDateAndTime: '',
            landingDateAndTime: '',
            maxAltitude: '',
            modelOfSpaceCraft: '',
        });
        setErrors({});
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    if (!open) return null;

    return (
        <>
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: '#1a1a1a',
                    color: '#ffffff'}}>

                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #333'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RocketLaunchIcon sx={{ color: '#bf60faff' }} />
                        <Typography variant="h6" sx={{ color: '#ffffff' }}>
                            New Flight Registration
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small" sx={{ color: '#9ca3af' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{ flex: 1, overflowY: 'auto', p: 3 }}>

                    <Stack spacing={3}>
                        <TextField
                            label="Flight Name"
                            value={formData.flightName}
                            onChange={handleChange('flightName')}
                            error={!!errors.flightName}
                            helperText={errors.flightName}
                            required
                            fullWidth
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }
                                },
                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' },
                            }}
                        />

                        <Divider
                            textAlign="left"
                            sx={{
                                borderColor: '#374151',
                                '&::before, &::after': { borderColor: '#374151' }
                            }}
                        >
                            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                                Launch Location
                            </Typography>
                        </Divider>

                        <TextField
                            label="Starting Latitude"
                            type="number"
                            value={formData.startingLatitude}
                            onChange={handleChange('startingLatitude')}
                            error={!!errors.startingLatitude}
                            helperText={errors.startingLatitude || 'Range: -90 to 90'}
                            required
                            fullWidth
                            inputProps={{ step: 'any' }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />

                        <TextField
                            label="Starting Longitude"
                            type="number"
                            value={formData.startingLongitude}
                            onChange={handleChange('startingLongitude')}
                            error={!!errors.startingLongitude}
                            helperText={errors.startingLongitude || 'Range: -180 to 180'}
                            required
                            fullWidth
                            inputProps={{ step: 'any' }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />

                        <Divider
                            textAlign="left"
                            sx={{
                                borderColor: '#374151',
                                '&::before, &::after': { borderColor: '#374151' }
                            }}
                        >
                            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                                Landing Location
                            </Typography>
                        </Divider>

                        <TextField
                            label="Ending Latitude"
                            type="number"
                            value={formData.endingLatitude}
                            onChange={handleChange('endingLatitude')}
                            error={!!errors.endingLatitude}
                            helperText={errors.endingLatitude || 'Range: -90 to 90'}
                            required
                            fullWidth
                            inputProps={{ step: 'any' }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />

                        <TextField
                            label="Ending Longitude"
                            type="number"
                            value={formData.endingLongitude}
                            onChange={handleChange('endingLongitude')}
                            error={!!errors.endingLongitude}
                            helperText={errors.endingLongitude || 'Range: -180 to 180'}
                            required
                            fullWidth
                            inputProps={{ step: 'any' }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />

                        <Divider
                            textAlign="left"
                            sx={{
                                borderColor: '#374151',
                                '&::before, &::after': { borderColor: '#374151' }
                            }}
                        >
                            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                                Flight Details
                            </Typography>
                        </Divider>

                        <TextField
                            label="Launch Date and Time"
                            type="datetime-local"
                            value={formData.launchDateAndTime}
                            onChange={handleChange('launchDateAndTime')}
                            error={!!errors.launchDateAndTime}
                            helperText={errors.launchDateAndTime}
                            required
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />

                        <TextField
                            label="Landing Date and Time"
                            type="datetime-local"
                            value={formData.landingDateAndTime}
                            onChange={handleChange('landingDateAndTime')}
                            error={!!errors.landingDateAndTime}
                            helperText={errors.landingDateAndTime}
                            required
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />

                        <TextField
                            label="Max Altitude (km)"
                            type="number"
                            value={formData.maxAltitude}
                            onChange={handleChange('maxAltitude')}
                            error={!!errors.maxAltitude}
                            helperText={errors.maxAltitude}
                            required
                            fullWidth
                            inputProps={{ step: 'any', min: 0 }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />

                        <TextField
                            label="Model of Spacecraft"
                            value={formData.modelOfSpaceCraft}
                            onChange={handleChange('modelOfSpaceCraft')}
                            error={!!errors.modelOfSpaceCraft}
                            helperText={errors.modelOfSpaceCraft}
                            required
                            fullWidth
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    color: '#ffffff',
                                    '& fieldset': { borderColor: '#4b5563' },
                                    '&:hover fieldset': { borderColor: '#6b7280' },
                                    '&.Mui-focused fieldset': { borderColor: '#60a5fa' }},

                                '& .MuiInputLabel-root': { color: '#9ca3af' },
                                '& .MuiInputLabel-root.Mui-focused': { color: '#60a5fa' },
                                '& .MuiFormHelperText-root': { color: '#9ca3af' },
                                '& .MuiFormHelperText-root.Mui-error': { color: '#ef4444' }}}
                        />
                    </Stack>
                </Box>

                <Divider sx={{ borderColor: '#374151' }} />

                <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={handleReset}
                        fullWidth
                        sx={{
                            color: '#9ca3af',
                            borderColor: '#4b5563',
                            '&:hover': {
                                borderColor: '#6b7280',
                                backgroundColor: '#1f2937'
                            }
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        fullWidth
                        sx={{
                            backgroundColor: '#bf60faff
                            ', '&:hover': {
                                backgroundColor: '#2563eb'
                            } }}>Register
                    </Button>
                </Box>
            </Box>
        </>
    );
}