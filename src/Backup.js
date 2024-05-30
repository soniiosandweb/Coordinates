import React, { useRef, useState, useEffect } from 'react';
import { Box, Button, ButtonGroup, Flex, HStack, IconButton, Input, Text, } from '@chakra-ui/react';
import { FaLocationArrow, FaTimes } from 'react-icons/fa';
import { useJsApiLoader, GoogleMap, Autocomplete, DirectionsRenderer } from '@react-google-maps/api';
import pdfToText from 'react-pdftotext';
import { useToast } from '@chakra-ui/react'


function App() {
    // It will run when page is load//
    const { isLoaded } = useJsApiLoader({
        // Goggle Map Api //
        googleMapsApiKey: process.env.REACT_APP_API_MAP_KEY,
        libraries: ['places'],
    });

    const [center, setCenter] = useState(null);
    const [destination, setDestinatiom] = useState(null);
    // const [start, setStart] = useState({ lat: 30.7333, lng:76.7794}); 

    // const [end , setEnd ] =  useState({ lat: 29.9457, lng:78.1642 });
    const [points, setPoints] = useState(null);
    const [map, setMap] = useState(null);
    const [directionsResponse, setDirectionsResponse] = useState(null);
    const [distance, setDistance] = useState('');
    const [duration, setDuration] = useState('');
    const [currentlocation, setCurrentLocation] = useState('');
    const toast = useToast();
    const originRef = useRef();
    const destinationRef = useRef();
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

                        // Fetch location details using Google Maps Geocoding API
                        const apiKey = process.env.REACT_APP_API_MAP_KEY;
                        const response = await fetch(`${process.env.REACT_APP_API_MAP_URL}?latlng=${pos.lat},${pos.lng}&key=${apiKey}`);
                        const data = await response.json();

                        if (data.results && data.results.length > 0) {
                            const locationName = data.results[0].formatted_address;
                            // console.log(locationName);
                            setCurrentLocation(locationName);
                            // You can display the location name in your UI or store it in state as needed
                        } else {
                            console.log('Location name not found');
                        }
                    },
                    () => {
                        toast({
                            description: "Error: The Geolocation service failed.",
                            position: "top",
                            status: "error",
                            duration: 2500,
                            isClosable: true,
                        });
                    }
                );
            } else {
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
       
        // This condition will show alert error for empty input//
        if (!points || points.length === 0) {
            if (originRef.current.value === '' || destinationRef.current.value === '') {
                toast({
                    description: "Please fill Something Between Start / Finsih loaction Or Pdf..",
                    position: "top",
                    status: "error",
                    duration: 1500,
                    isClosable: true,
                });

                return
            }
            // eslint-disable-next-line no-undef
            // It will calculate route between two points start / finish//
            const directionsService = new window.google.maps.DirectionsService();
            const results = await directionsService.route({
                origin: originRef.current.value,
                destination: destinationRef.current.value,
                // eslint-disable-next-line no-undef
                travelMode: google.maps.TravelMode.DRIVING,
            })

            console.log(results);
            setDirectionsResponse(results)
            setDistance(results.routes[0].legs[0].distance.text)
            setDuration(results.routes[0].legs[0].duration.text)


        }
        console.log(points)
        console.log(center)
        console.log(destination)
        // This alert for if pdf waypoint is more then 25 //
        if (points) {
            if (points.length >= 40) {
                toast({
                    description: "Please upload less then 25 waypoints...",
                    position: "top",
                    status: "error",
                    duration: 1500,
                    isClosable: true,
                });
            }
            else {
                const waypoints = [];
                points.map((point) => (
                  waypoints.push({
                    location: point,
                  })
                ))
                // This will send request to api for all functions //
                const request = {
                    origin: center,
                    destination: destination,
                    waypoints: waypoints,
                    optimizeWaypoints: true,
                    provideRouteAlternatives: true,
                    avoidFerries: false,
                    avoidHighways: false,
                    avoidTolls: false,
                    unitSystem: window.google.maps.UnitSystem.METRIC,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                }
                // PDF FUNCTION that will calculate pdf waypoints //
                const directionsService = new window.google.maps.DirectionsService();
                await directionsService.route(request, function (response, status) {
                    if (status === window.google.maps.DirectionsStatus.OK) {
                        // console.log(response);
                        setDirectionsResponse(response);
                        computeTotalDistance(response);
                    }
                });
            }}
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

    }
    // This function will clear the route and reset the input fields //
    function clearRoute() {
        window.location.reload();
        setDirectionsResponse(null);
        setDistance('');
        setDuration('');
        originRef.current.value = '';
        destinationRef.current.value = '';
    }

    // This function will extract text from a pdf file and put into array //
    function extractText(event) {
        const file = event.target.files[0];
        pdfToText(file)
            .then(text => {
                const textArray = text.split(' '); // Split text into an array based on spaces
                const extractedDecimals = textArray.filter(value => /\d+\.\d+/.test(value));

                const newPoints = extractedDecimals.reduce((acc, curr, index) => {
                    if (index % 2 === 0) { // Start from index 0
                        acc.push({ lat: parseFloat(extractedDecimals[index + 1]), lng: parseFloat(extractedDecimals[index]) });
                    }
                    return acc;
                }, []);
                // setCenter(newPoints[0]);
                // console.log(center);

                console.log(newPoints);
                // console.log(newPoints[0])
                updatePoints(newPoints);
                // console.log(points);
            })
            .catch(error => console.error("Failed to extract text from pdf"));
    }

    function updatePoints(pts) {
        setCenter(pts[0]);
        setDestinatiom(pts[pts.length -1 ]);
        setPoints(pts.slice(1, -1));
    }

    return (
        <Flex
            position='relative'
            flexDirection='column'
            alignItems='center'
            h='100vh'
            w='100vw'
        >
            <Box position='absolute' left={0} top={0} h='100%' w='100%'>
                <GoogleMap
                    center={center}
                    zoom={8}
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    options={{
                        // zoomControl: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                    }}
                    onLoad={map => setMap(map)}
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
                borderRadius='lg'
                m={4}
                bgColor='white'
                shadow='base'
                minW='container.md'
                zIndex='1'
            >
                <HStack spacing={2} justifyContent='space-between'>
                    <Box flexGrow={1}>
                        <Autocomplete>
                            <Input type='text' defaultValue={currentlocation} placeholder='Start'
                                ref={originRef} />
                        </Autocomplete>
                    </Box>
                    <Box flexGrow={1}>
                        <Autocomplete>
                            <Input
                                type='text'
                                placeholder='Finish'
                                ref={destinationRef}
                            />
                        </Autocomplete>

                    </Box>
                    <input type="file" accept="application/pdf" onChange={extractText} />

                    
                    <ButtonGroup>
                        <Button colorScheme='blue' type='submit' onClick={calculateRoute}>
                            Calculate Route
                        </Button>
                        <IconButton
                            aria-label='center back'
                            icon={<FaTimes />}
                            onClick={clearRoute}
                        />
                    </ButtonGroup>
                </HStack>
                <HStack spacing={4} mt={4} justifyContent='space-between'>
                    <Text className='distance'>Distance: {distance} </Text>
                    <Text className='distance'>Duration: {duration} </Text>
                    <IconButton
                        aria-label='center back'
                        icon={<FaLocationArrow />}
                        isRound
                        onClick={() => {
                            map.panTo(center);
                            map.setZoom(15);
                        }}
                    />
                </HStack>
            </Box>
        </Flex>
    );
}

export default App;