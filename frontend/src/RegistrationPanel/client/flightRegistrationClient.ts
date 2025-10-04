import axiosInstance from '../../../AxiosInstance/AxiosInstance'
import { RegistrationInformationType } from '../RegistrationPanel';

const API_ENDPOINTS = {
    REGISTER_FLIGHT: 'api/register-flight',
};

export const registerFlight = (
    flightData: Omit<RegistrationInformationType, 'id'>,
): Promise<RegistrationInformationType> =>
    axiosInstance
        .post(API_ENDPOINTS.REGISTER_FLIGHT, flightData)
        .then((response) => response.data as RegistrationInformationType)
        .catch(() => Promise.reject('Failed to register flight'));

export const getRegisteredFlights = (): Promise<RegistrationInformationType[]> =>
    axiosInstance
        .get(API_ENDPOINTS.REGISTER_FLIGHT)
        .then((response) => response.data as RegistrationInformationType[])
        .catch(() => Promise.reject('Failed to fetch registered flights'));

export const updateFlightRegistration = (
    flightData: RegistrationInformationType,
): Promise<RegistrationInformationType> =>
    axiosInstance
        .put(`${API_ENDPOINTS.REGISTER_FLIGHT}/${flightData.id}`, flightData)
        .then((response) => response.data as RegistrationInformationType)
        .catch(() => Promise.reject('Failed to update flight registration'));

export const deleteFlightRegistration = (
    flightId: number,
): Promise<void> =>
    axiosInstance
        .delete(`${API_ENDPOINTS.REGISTER_FLIGHT}/${flightId}`)
        .then(() => undefined)
        .catch(() => Promise.reject('Failed to delete flight registration'));