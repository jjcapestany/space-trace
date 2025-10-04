package com.fortuna.FlightRegistration.Service;

import com.fortuna.FlightRegistration.Controller.FlightRegistrationDTO;
import com.fortuna.FlightRegistration.Persistance.FlightRegistrationRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@AllArgsConstructor
public class FlightRegistrationService {

    private final FlightRegistrationRepository flightRegistrationRepository;

    public FlightRegistrationDTO registerFlight(FlightRegistrationDTO flightRegistration) {
        return flightRegistrationRepository.save(flightRegistration);
    }

    public List<FlightRegistrationDTO> getAllFlightRegistrations() {
        return flightRegistrationRepository.findAll();
    }

    public FlightRegistrationDTO updateFlightRegistration(FlightRegistrationDTO flightRegistration) {
        return flightRegistrationRepository.save(flightRegistration);
    }

    public void deleteFlightRegistration(Long id) {
        flightRegistrationRepository.deleteById(id);
    }
}