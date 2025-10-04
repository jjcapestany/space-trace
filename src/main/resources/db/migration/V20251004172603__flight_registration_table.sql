CREATE TABLE flight_data (
                             id BIGSERIAL PRIMARY KEY,
                             flight_name VARCHAR(255) NOT NULL,
                             starting_latitude DOUBLE PRECISION NOT NULL,
                             starting_longitude DOUBLE PRECISION NOT NULL,
                             ending_latitude DOUBLE PRECISION NOT NULL,
                             ending_longitude DOUBLE PRECISION NOT NULL,
                             launch_date_and_time TIMESTAMP NOT NULL,
                             landing_date_and_time TIMESTAMP NOT NULL,
                             max_altitude DOUBLE PRECISION NOT NULL,
                             model_of_space_craft VARCHAR(255) NOT NULL
);