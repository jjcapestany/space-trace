package com.fortuna.FlightRegistration.Persistance;

import com.fortuna.FlightRegistration.Controller.FlightRegistrationDTO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FlightRegistrationRepository extends JpaRepository<FlightRegistrationDTO, Long> {
}
