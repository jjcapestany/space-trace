package com.fortuna.FlightRegistration.Controller;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "flight_data")
@Data
@AllArgsConstructor
@NoArgsConstructor
public class FlightRegistrationDTO {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "flight_name", nullable = false)
    private String flightName;

    @Column(name = "starting_latitude", nullable = false)
    private Double startingLatitude;

    @Column(name = "starting_longitude", nullable = false)
    private Double startingLongitude;

    @Column(name = "ending_latitude", nullable = false)
    private Double endingLatitude;

    @Column(name = "ending_longitude", nullable = false)
    private Double endingLongitude;

    @Column(name = "launch_date_and_time", nullable = false)
    private LocalDateTime launchDateAndTime;

    @Column(name = "landing_date_and_time", nullable = false)
    private LocalDateTime landingDateAndTime;

    @Column(name = "max_altitude", nullable = false)
    private Double maxAltitude;

    @Column(name = "model_of_space_craft", nullable = false)
    private String modelOfSpaceCraft;
}