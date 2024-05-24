/* eslint-disable no-undef */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useRef, useState, useEffect } from "react";
import "./App.css";
import "./table.css";
import pdfToText from "react-pdftotext";
import { FaTimes } from "react-icons/fa";
import { AlertTitle, useToast } from "@chakra-ui/react";
import { sortByDistance } from "sort-by-distance";
import { Skeleton, Stack } from "@chakra-ui/react";
import { useJsApiLoader, GoogleMap, Autocomplete, DirectionsRenderer } from "@react-google-maps/api";
import { Box, Button, ButtonGroup, Flex, HStack, IconButton, Input, Text, Select, } from "@chakra-ui/react";
import {Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, useDisclosure,} from "@chakra-ui/react";

function App() {
    // It will run when page is load//
    const { isLoaded } = useJsApiLoader({
        // Goggle Map Api //
        googleMapsApiKey: "AIzaSyDK7__8q3wspnLRdnMPtjVkSuCNaHnh0nU",
        libraries: ["places"],
    });
    const [fileInputKey, setFileInputKey] = useState(0);
    const [center, setCenter] = useState(null);
    const [points, setPoints] = useState(null);
    const [map, setMap] = useState(null);
    const [directionsResponse, setDirectionsResponse] = useState(null);
    const [distance, setDistance] = useState("");
    const [duration, setDuration] = useState("");
    const [currentlocation, setCurrentLocation] = useState("");
    const toast = useToast();
    // eslint-disable-next-line no-unused-vars
    const [coordinateSuggestions, setCoordinateSuggestions] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(currentlocation);
    const originRef = useRef();
    const destinationRef = useRef();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [size, setSize] = React.useState("full");
    const [modalData, setModalData] = useState("");
    const [isLoading, setIsLoading] = useState(true); // State to track loading state
    const [tableData, setTableData] = useState("");
    
       useEffect(() => {
        if (isLoaded) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const pos = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };
                        setCenter(pos);
                        const marker = new window.google.maps.Marker({
                            position: pos,
                            map,
                            title: "Current Location",
                        });
                        // Fetch location details using Google Maps Geocoding API
                        const apiKey = "AIzaSyDK7__8q3wspnLRdnMPtjVkSuCNaHnh0nU";
                        const response = await fetch(
                            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.lat},${pos.lng}&key=${apiKey}`
                        );
                        const data = await response.json();

                        if (data.results && data.results.length > 0) {
                            const locationName = data.results[0].formatted_address;
                            // console.log(locationName);
                            setCurrentLocation(locationName);
                            // You can display the location name in your UI or store it in state as needed
                        } else {
                            console.log("Location name not found");
                        }
                    },
                    () => {
                        toast({
                            description: "Please Allow The Location To Acces Your Current Location.",
                            position: "top",
                            status: "error",
                            duration: 3500,
                            isClosable: true,
                        });
                    }
                );
            } 
            else {
                toast({
                    description: "Error: Your browser doesn't support geolocation.",
                    position: "top",
                    status: "error",
                    duration: 2500,
                    isClosable: true,
                });
            }
        }
    }, [isLoaded, toast]);

    if (!isLoaded) {
        return;
    }
    // calculate route function//
    async function calculateRoute() {
        setPoints(null); // Clear existing points
        setDirectionsResponse(null);

        // This condition will show alert error for empty input//
        if (!points || points.length === 0) {
            if (
                originRef.current.value === "" ||
                destinationRef.current.value === ""
            ) {
                toast({
                    description: "Please fill Something Between Finsih loaction Or Pdf..",
                    position: "top",
                    status: "error",
                    duration: 1500,
                    isClosable: true,
                });

                return;
            }
            // It will calculate route between two points start / finish//
            const directionsService = new window.google.maps.DirectionsService();
            const results = await directionsService.route({
                origin: originRef.current.value,
                destination: destinationRef.current.value,
                travelMode: google.maps.TravelMode.DRIVING,
            });

            // console.log(results);
            setDirectionsResponse(results);
            setDistance(results.routes[0].legs[0].distance.text);
            setDuration(results.routes[0].legs[0].duration.text);
        }
        // console.log(points)
        // console.log(center)
        // This alert for if pdf waypoint is more then 25 //
        if (points) {
            if (points.length >= 50) {
                toast({
                    description: "Please upload less then 50 waypoints...",
                    position: "top",
                    status: "error",
                    duration: 1500,
                    isClosable: true,
                });
            } else {
                const markers = [];
                // points.unshift(originRef.current.value 
                points.forEach((stop, index) => {
                    const marker = new window.google.maps.Marker({
                        position: stop,
                        map,
                        title: stop.name,
                        label: { text: `${index + 1}`, color: "white" },
                    });
                    markers.push(marker);
                });
                console.log(points);

                for (var a = 0, parts = [], max = 23; a < points.length; a = a + max)
                    parts.push(points.slice(a, a + max));

                // console.log(parts)

                for (var b = 0; b < parts.length; b++) {
                    const directionsService = new window.google.maps.DirectionsService();
                    const directionsRenderer = new window.google.maps.DirectionsRenderer({
                        draggable: false,
                        map,
                        index: b,
                        suppressMarkers: true,
                    });

                    // Calculate and display the route
                    async function calculateAndDisplayRoute(
                        services,
                        directionsRenderer
                    ) {
                        return await directionsService.route(
                            services,
                            (response, status) => {
                                if (status === "OK") {
                                    directionsRenderer.setDirections(response);
                                    // console.log(response)
                                    computeTotalDistance(response);
                                } else {
                                    // window.alert("Directions request failed due to " + status);
                                    // console.log(status)
                                }
                            }
                        );
                    }

                    var waypoints = [];
                    // Waypoints does not include first station (origin) and last station (destination)
                    for (var j = 0; j < parts[b]?.length; j++) {
                        waypoints.push({ location: parts[b][j], stopover: false });
                    }
                    // Service options
                    // eslint-disable-next-line eqeqeq
                    var origin = b == 0 ? parts[0][0] : parts[b - 1][parts[b - 1].length - 1];
                    var service_options = {
                        origin: originRef.current.value,
                        destination: parts[b][parts[b].length - 1],
                        waypoints: waypoints,
                        optimizeWaypoints: true,
                        provideRouteAlternatives: true,
                        avoidFerries: false,
                        avoidHighways: false,
                        avoidTolls: false,
                        unitSystem: window.google.maps.UnitSystem.METRIC,
                        travelMode: window.google.maps.TravelMode.DRIVING,
                    };

                    // Trigger initial route calculation
                    calculateAndDisplayRoute(service_options, directionsRenderer);
                    //  console.log(directionsRenderer)
                }
            }
        }
    }
    // It will define the distance and duration of the route //

    function computeTotalDistance(result) {
        var totalDist = 0;
        var totalTime = 0;
        var myroute = result.routes[0];
        for (var i = 0; i < myroute.legs.length; i++) {
            totalDist += myroute.legs[i].distance.value;
            totalTime += myroute.legs[i].duration.value;
        }
        totalDist = totalDist / 1000;
        var hours = Math.floor(totalTime / 3600); // Convert total time to hours
        var minutes = Math.floor((totalTime % 3600) / 60); // Calculate remaining minutes
        setDistance(totalDist + " km");
        setDuration(hours + " hours and " + minutes + " minutes");
        console.log(distance);
    }
    // This function will clear the route and reset the input fields //
    function clearRoute() {
        window.location.reload();
        // setFileInputKey(prevKey => prevKey + 1); This will clear pdf input
        setDirectionsResponse(null);
        setDistance("");
        setDuration("");
        originRef.current.value = "";
        destinationRef.current.value = "";
    }

    // This function will extract text from a pdf file and put into array and make path the most important function //
    function extractText(event) {
        setTableData("")
        const file = event.target.files[0];
        pdfToText(file)
            .then(async (text) => {
                const textArray = text.split(" "); // Split text into an array based on spaces
                const extractedDecimals = textArray.filter((value) => /\d+\.\d+/.test(value));
                const newPoints = extractedDecimals.reduce((acc, curr, index) => {
                    if (index % 2 === 0) {
                        // Start from index 0
                        acc.push({
                            lat: parseFloat(extractedDecimals[index + 1]),
                            lng: parseFloat(extractedDecimals[index]),
                        });
                    }
                    return acc;
                }, []);

                const locationNames = textArray.filter(
                    (value) => isNaN(parseFloat(value)) && value.length > 1
                );
                // Filter out non-numeric values and short words
                // Assign location names to the corresponding points
                newPoints.forEach((point, index) => {
                    if (locationNames[index]) {
                        point.name = locationNames[index];
                    }
                });

                //console.log(newPoints);

                // Update the UI or state with the newPoints array containing location names
                setModalData(newPoints);
                distancess(newPoints);

                const coordinateSuggestions = newPoints.map(
                    (coordinate) =>
                        `${coordinate.lng} ${coordinate.lat} ${coordinate.name}`

                );
                updatePoints(newPoints);
                setCoordinateSuggestions(newPoints.map((point) => `${point.name}`));
                onOpen();

            })
            //${point.lng} ${point.lat}
            .catch((error) => console.error("Failed to extract text from pdf"));
    }

    function updatePoints(points) {
        setCenter(points[0]);

        const opts = {
            yName: "lat",
            xName: "lng",
            type: "linear",
        };

        let currentPath = [points[0]];
        let remainingPoints = points.slice(1);
        while (remainingPoints.length > 0) {
            const nextPoint = sortByDistance(
                currentPath[currentPath.length - 1],
                remainingPoints,
                opts
            )[0];
            currentPath.push(nextPoint);
            remainingPoints = remainingPoints.filter((p) => p !== nextPoint);
        }
        //   console.log(distance); // shortest path between all points

        setPoints(currentPath);
        // Set the sorted points using setPoints
        // setPoints(sortByDistance(points[0], points, opts));
    }

    // IT WILL SELECT THE CORDINATES DROPDOWN //
    const handleCoordinateSelection = (selectedValue) => {
        if (!selectedValue.includes("PDF Location")) {
            const [latitude, longitude, name] = selectedValue.split(" ");
            setCenter({ lat: parseFloat(latitude), lng: parseFloat(longitude) });
            setSelectedLocation(name); // Set the selected location name
            originRef.current.value = `${latitude}`;
            console.log(latitude);
            // Set the selected coordinates in the input field
        }
    };

    //////////////This code for pdf cordinates table/////////////////////////////////////

    async function calculateRoutet(point, points, s) {
        setIsLoading(true);
        var datHtml = "";

        for (var i = 0; i < points.length; i++) {
            const directionsService = new window.google.maps.DirectionsService();
            const results = await directionsService.route({
                origin: point,
                destination: points[i],
                provideRouteAlternatives: false,
                avoidFerries: false,
                avoidHighways: false,
                avoidTolls: false,
                unitSystem: window.google.maps.UnitSystem.METRIC,
                travelMode: window.google.maps.TravelMode.DRIVING,
            });

            // console.log(results)

            datHtml += `<tr><td>${s + 1}</td><td class="data">${point.name}</td><td class="data">${points[i].name}</td><td>${results.routes[0].legs[0].distance.text}</td><td>${results.routes[0].legs[0].duration.text}</td></tr>`;
            setIsLoading(false);
        }

        return datHtml;
    }
    function Tabletext(event) {
        const file = event.target.files[0];
        pdfToText(file)
            .then((text) => {
                const textArray = text.split(" "); // Split text into an array based on spaces
                const extractedDecimals = textArray.filter((value) =>
                    /\d+\.\d+/.test(value)
                );
                const newPoints = extractedDecimals.reduce((acc, curr, index) => {
                    if (index % 2 === 0) {
                        // Start from index 0
                        acc.push({
                            lat: parseFloat(extractedDecimals[index + 1]),
                            lng: parseFloat(extractedDecimals[index]),
                        });
                    }
                    return acc;
                }, []);

                distancess(newPoints);
                onOpen();

                // updatePoints(newPoints);
                // console.log(points);
            })
            .catch((error) => console.error("Failed to extract text from pdf"));
    }
        function distancess(points) {
            var htmlRecord = "";

            for (var i = 0; i < points.length; i++) {
                // eslint-disable-next-line no-loop-func
                calculateRoutet(points[i], points, i).then((response) => {
                    console.log(response);
                    htmlRecord += `<table border="1"><tr><th>S.no</th><th>Start</th><th>Finish</th><th>Distance</th><th>Duration</th></tr>${response}</table>`;
                    document.getElementById("ab").innerHTML = htmlRecord;
                    console.log(htmlRecord)
                    setTableData(htmlRecord);
                    // Set the table data in the state
                    // console.log(points)
                });
            }
        }


   const jatin =() => {
}

    return (

        <Flex
            position="relative"
            flexDirection="column"
            alignItems="center"
            h="100vh"
            w="100vw"
        >
            <Box position="absolute" left={0} top={0} h="100%" w="100%">
                <GoogleMap
                    center={center}
                    zoom={8}
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    options={{
                        zoomControl: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                    }}
                    onLoad={(map) => setMap(map)}
                >

                    {directionsResponse && (
                        <DirectionsRenderer
                            directions={directionsResponse}
                            preserveViewport={true}
                        />
                    )}
                </GoogleMap>
            </Box>
            <Box
                p={4}
                borderRadius="lg"
                m={4}
                bgColor="white"
                shadow="base"
                minW="container.md"
                zIndex="1"
            >
                <HStack spacing={2} justifyContent="space-between">
                    <Box flexGrow={1}>
                        <Autocomplete>
                            <Input
                                type="text"
                                defaultValue={currentlocation}
                                placeholder="Start"
                                ref={originRef}
                            />
                        </Autocomplete>
                    </Box>
                    <Box flexGrow={1}>
                        <Text>{selectedLocation}</Text>
                        <Autocomplete>
                            <Input type="text" placeholder="Finish" ref={destinationRef} />
                        </Autocomplete>
                    </Box>
                    <input
                        key={fileInputKey}
                        type="file"
                        accept="application/pdf"
                        onChange={extractText}
                    />
                    <ButtonGroup>
                        <Button colorScheme="blue" type="submit" onClick={calculateRoute}>
                            Calculate Route
                        </Button>
                        <IconButton
                            aria-label="center back"
                            icon={<FaTimes />}
                            onClick={clearRoute}
                        />
                    </ButtonGroup>
                </HStack>
                <HStack spacing={8} mt={5} justifyContent="space-between">
                    <Select
                        value={selectedLocation}
                        onChange={(e) => handleCoordinateSelection(e.target.value)}>

                        <option value={selectedLocation} disabled selected hidden>
                            Select location
                        </option>
                        {coordinateSuggestions.map((coordinate, index) => {
                            if (!coordinate.includes("PDF Location")) {
                                return (
                                    <option key={index} value={coordinate}>
                                        {coordinate}
                                    </option>
                                );
                            }
                            return null;
                        })}
                    </Select>
                    <Text className="set">Distance: {distance} </Text>
                    <Text className="set">Duration: {duration} </Text>
                    <Button onClick={onOpen} colorScheme="black" variant="outline">
                        Table Data
                    </Button>
                    <div>
                        {isOpen && (
                            <Modal
                                size={size}
                                blockScrollOnMount={false}
                                isOpen={isOpen}
                                onClose={onClose}
                            >
                                <ModalOverlay />
                                <ModalContent>
                                    <ModalHeader justifyContent={center}>
                                        Pdf Cordinates Table
                                    </ModalHeader>
                                    <ModalCloseButton />
                                    <ModalBody>
                                        {isLoading ? (
                                            <Stack>
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                                <Skeleton speed={0.6} height="20px" /><br />
                                            </Stack>
                                        ) : (
                                            <div
                                                className="table-container"
                                                id="ab"
                                                dangerouslySetInnerHTML={{ __html: tableData }}>
                                            </div>
                                        )}

                                        <Button colorScheme="red" mx={42} onClick={jatin}>
                                            Load More
                                        </Button>
                                    </ModalBody>
                                    <ModalFooter>
                                        <Button colorScheme="blue" mr={3} onClick={onClose}>
                                            Close
                                        </Button>
                                    </ModalFooter>
                                </ModalContent>
                            </Modal>
                        )}
                    </div>
                </HStack>
            </Box>
        </Flex>
    );
}
export default App;