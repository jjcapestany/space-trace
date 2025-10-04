import React, { useState } from 'react';
import {
    Drawer,
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

export interface RegistrationInformationType {
    id: number;
    flightName: string;
    startingLatitude: number;
    startingLongitude: number;
    launchDateAndTime: Date;
    maxAltitude: number;
    modelOfSpaceCraft: string;
}

interface RegistrationSidePanelProps {
    open?: boolean;
    onClose?: () => void;
    onSubmit?: (data: Omit<RegistrationInformationType, 'id'>) => void;
    initialData?: RegistrationInformationType;
}

function RegistrationSidePanel({
                                   open = true,
                                   onClose = () => {},
                                   onSubmit = (data) => console.log('Submitted:', data),
                                   initialData,
                               }: RegistrationSidePanelProps) {
    const [formData, setFormData] = useState({
        flightName: initialData?.flightName || '',
        startingLatitude: initialData?.startingLatitude?.toString() || '',
        startingLongitude: initialData?.startingLongitude?.toString() || '',
        launchDateAndTime: initialData?.launchDateAndTime
            ? new Date(initialData.launchDateAndTime).toISOString().slice(0, 16)
            : '',
        maxAltitude: initialData?.maxAltitude?.toString() || '',
        modelOfSpaceCraft: initialData?.modelOfSpaceCraft || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (field: string) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
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

        const lat = parseFloat(formData.startingLatitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
            newErrors.startingLatitude = 'Latitude must be between -90 and 90';
        }

        const lng = parseFloat(formData.startingLongitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
            newErrors.startingLongitude = 'Longitude must be between -180 and 180';
        }

        if (!formData.launchDateAndTime) {
            newErrors.launchDateAndTime = 'Launch date and time is required';
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
                launchDateAndTime: new Date(formData.launchDateAndTime),
                maxAltitude: parseFloat(formData.maxAltitude),
                modelOfSpaceCraft: formData.modelOfSpaceCraft,
            };
            onSubmit(submitData);
        }
    };

    const handleReset = () => {
        setFormData({
            flightName: '',
            startingLatitude: '',
            startingLongitude: '',
            launchDateAndTime: '',
            maxAltitude: '',
            modelOfSpaceCraft: '',
        });
        setErrors({});
    };

    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box sx={{ width: 400, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RocketLaunchIcon color="primary" />
                        <Typography variant="h6">
                            {initialData ? 'Edit Flight Registration' : 'New Flight Registration'}
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Divider />

                <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{ flex: 1, overflowY: 'auto', p: 3 }}
                >
                    <Stack spacing={3}>
                        <TextField
                            label="Flight Name"
                            value={formData.flightName}
                            onChange={handleChange('flightName')}
                            error={!!errors.flightName}
                            helperText={errors.flightName}
                            required
                            fullWidth
                        />

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
                        />

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
                        />

                        <TextField
                            label="Model of Spacecraft"
                            value={formData.modelOfSpaceCraft}
                            onChange={handleChange('modelOfSpaceCraft')}
                            error={!!errors.modelOfSpaceCraft}
                            helperText={errors.modelOfSpaceCraft}
                            required
                            fullWidth
                        />
                    </Stack>
                </Box>

                <Divider />

                <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={handleReset}
                        fullWidth
                    >
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        fullWidth
                    >
                        {initialData ? 'Update' : 'Register'}
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
}

export default RegistrationSidePanel;