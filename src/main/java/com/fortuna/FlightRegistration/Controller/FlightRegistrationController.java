package com.fortuna.FlightRegistration.Controller;

import com.fortuna.FlightRegistration.Service.FlightRegistrationService;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@AllArgsConstructor
public class FlightRegistrationController {


    private final FlightRegistrationService flightRegistrationService;

    @PostMapping("/api/register-flight")
    public ResponseEntity<FlightRegistrationDTO> registerFlight(@RequestBody FlightRegistrationDTO flightRegistration) {
        FlightRegistrationDTO registeredFlight = flightRegistrationService.registerFlight(flightRegistration);
        return ResponseEntity.status(201).body(registeredFlight);
    }

    @GetMapping("/api/register-flight")
    public ResponseEntity<List<FlightRegistrationDTO>> getAllFlightRegistrations() {
        List<FlightRegistrationDTO> flightRegistrations = flightRegistrationService.getAllFlightRegistrations();
        return ResponseEntity.status(200).body(flightRegistrations);
    }

    @PutMapping("/api/register-flight/{id}")
    public ResponseEntity<FlightRegistrationDTO> updateFlightRegistration(
            @PathVariable Long id,
            @RequestBody FlightRegistrationDTO flightRegistration) {
        flightRegistration.setId(id);
        FlightRegistrationDTO updatedFlight = flightRegistrationService.updateFlightRegistration(flightRegistration);
        return ResponseEntity.status(200).body(updatedFlight);
    }

    @DeleteMapping("/api/register-flight/{id}")
    public ResponseEntity<Void> deleteFlightRegistration(@PathVariable Long id) {
        flightRegistrationService.deleteFlightRegistration(id);
        return ResponseEntity.status(204).build();
    }
}