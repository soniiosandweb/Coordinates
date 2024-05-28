import React, { useRef, useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { useToast } from "@chakra-ui/react";
import { sortByDistance } from "sort-by-distance";
import { LoadScript,GoogleMap, Autocomplete } from "@react-google-maps/api";
import { Box, Button, ButtonGroup, Flex, HStack, IconButton, Input, Text, Select, Spinner} from "@chakra-ui/react";
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, useDisclosure } from "@chakra-ui/react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import {retrievePdfData} from './actions/pdfdata'

function Map() {
  const fileInputKey = useRef();
  const [center, setCenter] = useState(null);
  const [defaultCenter, setDefaultCenter] = useState(null);
  const [points, setPoints] = useState(null);
  const [map, setMap] = useState(null);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [currentlocation, setCurrentLocation] = useState("");
  const toast = useToast();
  const [selectedLocation, setSelectedLocation] = useState(currentlocation);
  const originRef = useRef();
  const destinationRef = useRef();
  // const { isOpen, onOpen, onClose } = useDisclosure();
  const [tableData, setTableData] = useState(null);
  const [file, setFile] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const dispatch = useDispatch();
  const {pdfItems} = useSelector((state) => state.pdfcontents);

  let totalDist = [];

  const [prevRoute, setPrevRoute] = React.useState([]);
  const [marker, setMarker] = React.useState([]);

  const modalTable = useDisclosure();
  const modalForm = useDisclosure();
  const [formData, setFormData] = useState(null);

  useEffect(() => {

      if (navigator.geolocation) {

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setCenter(pos);
            setDefaultCenter(pos);
            const apiKey = process.env.REACT_APP_API_Map_Key;
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.lat},${pos.lng}&key=${apiKey}`
            );
            const data = await response.json();

            if (data.results && data.results.length > 0) {
              const locationName = data.results[0].formatted_address;
              setCurrentLocation(locationName);
            } else {
              console.log("Location name not found");
            }
          },
          () => {
            toast({
              description:
                "Please Allow The Location To Acces Your Current Location.",
              position: "top",
              status: "error",
              duration: 3500,
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

  }, [ toast]);

  // calculate route function//
  async function calculateRoute() {
    
    setLoadingData(true);

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
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
      });

      const results = await directionsService.route({
        origin: originRef.current.value,
        destination: destinationRef.current.value,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      directionsRenderer.setDirections(results);

      if (prevRoute.length) {
        prevRoute.forEach((prevRoute)=> {
            prevRoute.setMap(null);
        })
      }

      setPrevRoute([directionsRenderer]);

      setLoadingData(false);

      // setDirectionsResponse(results);
      setDistance(results.routes[0].legs[0].distance.text);
      setDuration(results.routes[0].legs[0].duration.text);
    }
   
    // This alert for if pdf waypoint is more then 50 //
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

        if (prevRoute.length) {
          prevRoute.forEach((prevRoute)=> {
            prevRoute.setMap(null);
          })
        }

        if (marker.length) {
          marker.forEach((marker)=> {
            marker.setMap(null)
          })
        }

        const markers = [];

        points.forEach((stop, index) => {
          const marker = new window.google.maps.Marker({
            position: stop,
            map,
            title: stop.name,
            label: { text: `${index + 1}`, color: "white" },
          });
          markers.push(marker);
        });
        setMarker(markers);

        for (var a = 0, parts = [], max = 23; a < points.length; a = a + max)
          parts.push(points.slice(a, a + max));

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

                  setPrevRoute(prevRoute => [...prevRoute, directionsRenderer]);

                  computeTotalDistanceNew(response);

                  setLoadingData(false);

                } else {
                  window.alert("Directions request failed due to " + status);
                  setLoadingData(false);
                }
              }
            );
          }

          var waypoints = [];
          // Waypoints does not include first station (origin) and last station (destination)
          for (var j = 0; j < parts[b]?.length; j++) {
            waypoints.push({ location: parts[b][j], stopover: false });
          }

          var origin =
            center && b === 0
              ? center
              : b === 0
              ? parts[0][0]
              : parts[b - 1][parts[b - 1].length - 1];

          var service_options = {
            origin: origin,
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

          // Trigger route calculation
          calculateAndDisplayRoute(service_options, directionsRenderer);
        }
      }
    }
  }
  // It will define the distance and duration of the route //

  function computeTotalDistanceNew(result){
    
    if(result){
      totalDist.push(result);
      computeTotalDistance(totalDist);
    }
  }

  function computeTotalDistance(results) {
    var totalDist = 0;
    var totalTime = 0;
    results.forEach((result) => {
        var myroute = result.routes[0];
        for (var i = 0; i < myroute.legs.length; i++) {
          totalDist += myroute.legs[i].distance.value;
          totalTime += myroute.legs[i].duration.value;
        }
    })
    
    totalDist = totalDist / 1000;
    var hours = Math.floor(totalTime / 3600); // Convert total time to hours
    var minutes = Math.floor((totalTime % 3600) / 60); // Calculate remaining minutes
    setDistance(totalDist + " km");
    setDuration(hours + " hours and " + minutes + " minutes");
 
  }

  // This function will clear the route and reset the input fields //
  function clearRoute() {
 
    setDistance("");
    setDuration("");

    if (prevRoute.length) {
      prevRoute.forEach((prevRoute)=> {
        prevRoute.setMap(null);
      })
    }

    if (marker.length) {
      marker.forEach((marker)=> {
        marker.setMap(null)
      })
    }
    originRef.current.value = "";
    destinationRef.current.value = "";
    setFile("")
    setPoints(null);
    setTableData(null);
    
  }

  // This function will extract text from a pdf file //
  function extractText(event) {

    setDistance("");
    setDuration("");

    if (prevRoute.length) {
      prevRoute.forEach((prevRoute)=> {
        prevRoute.setMap(null);
      })
    }

    if (marker.length) {
      marker.forEach((marker)=> {
        marker.setMap(null)
      })
    }

    setLoadingData(true);
    
    const file = event.target.files[0];
    setFile(event.target.value)
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async (e) => {
      axios({
        method: "post",
        url: "https://iosandweb.net/shortestpathfinder/api/pdf-txt.php",
        data: JSON.stringify({
          pdfFile: reader.result,
        }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      .then(function (response) {
        if (response.data) {
          setFormData(response.data);
          modalTable.onOpen();
          setLoadingData(false)
        }
      })
      .catch(function (response) {
        console.log(response);
        setLoadingData(false)
      });
    };
  }

  // Calculate Table Distance
  function calculateDistancePath(data){
    data.forEach(element => {
      calculateRoutePath(element, data)
    });
  }

  function calculateRoutePath(element, data){
    data.forEach(ele => {
      dispatch(retrievePdfData(element, ele))
    });
  }

  // Calculate shortest path
  function updatePoints(points) {
    setCenter(null);

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

    // setPoints(points);
    setPoints(currentPath)
  }

  // IT WILL SELECT THE CORDINATES DROPDOWN //
  const handleCoordinateSelection = (selectedValue) => {
    setSelectedLocation(selectedValue);

    var selectedElement = JSON.parse(selectedValue);
    setCenter(selectedElement);

    const foundIdx = points.findIndex((el) => el.id === selectedElement.id);

    const opts = {
      yName: "lat",
      xName: "lng",
      type: "linear",
    };

    const halfBeforeElement = points.slice(0, foundIdx);
    const halfAfterElement = points.slice(foundIdx + 1);
    let remainingPoints = halfBeforeElement.concat(halfAfterElement);

    let currentPath = [selectedElement];

    while (remainingPoints.length > 0) {
      const nextPoint = sortByDistance(
        currentPath[currentPath.length - 1],
        remainingPoints,
        opts
      )[0];
      currentPath.push(nextPoint);
      remainingPoints = remainingPoints.filter((p) => p !== nextPoint);
    }

    setPoints(currentPath);

    // let pathNew = currentPath.concat(remainingPoints);
    // setPoints(pathNew)
  };

  //////////////This code for pdf cordinates table//////////////
  function distancess() {
    if(points){
      modalForm.onOpen();
    } else {
      toast({
        description: "Error: Please upload PDF.",
        position: "top",
        status: "error",
        duration: 2500,
        isClosable: true,
      });
    }
  }

  return (
    <Flex position="relative" flexDirection="column" alignItems="center" h="100vh" w="100vw">
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_API_Map_Key}
        libraries={['places']}
      >
        <Box position="absolute" left={0} top={0} h="100%" w="100%">
          <GoogleMap
            center={defaultCenter}
            zoom={8}
            mapContainerStyle={{ width: "100%", height: "100%" }}
            options={{
              zoomControl: false,
              streetViewControl: false,
              mapTypeControl: false,
            }}
            onLoad={(map) => setMap(map)}
            onUnmount={() => setMap(null)}
          >
            {/* {directionsResponse && (
              <DirectionsRenderer
                directions={directionsResponse}
                preserveViewport={true}
              />
            )} */}
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
              <Autocomplete>
                <Input type="text" placeholder="Finish" ref={destinationRef} />
              </Autocomplete>
            </Box>
            <input
              key={fileInputKey}
              value={file}
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
              onChange={(e) => handleCoordinateSelection(e.target.value)}
            >
              <option value="" disabled>
                Select location
              </option>
              {tableData
                ? tableData.map((coordinate, index) => (
                    <option key={index} value={JSON.stringify(coordinate)}>
                      {coordinate.name}
                    </option>
                  ))
                : ""}
            </Select>
            <Text className="set">Distance: {distance} </Text>
            <Text className="set">Duration: {duration} </Text>
            <Button onClick={distancess} colorScheme="black" variant="outline">
              Table Data
            </Button>
            <div>
              {modalForm.isOpen && (
                <Modal
                  size="full"
                  blockScrollOnMount={false}
                  isOpen={modalForm.isOpen}
                  onClose={modalForm.onClose}
                >
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader justifyContent={center} textAlign={center}>
                      Pdf Cordinates Table
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <Box className="table-container">

                        {
                          tableData && pdfItems? 
                          tableData.map((res, index)=>(
                              <table key={index} border="1">
                                  <tbody>
                                    <tr>
                                      <th style={{width: "10%"}}>S.no</th>
                                      <th style={{width: "30%"}}>Start</th>
                                      <th style={{width: "30%"}}>Finish</th>
                                      <th style={{width: "15%"}}>Distance</th>
                                      <th style={{width: "15%"}}>Duration</th>
                                    </tr>
                                      {pdfItems.map((pdf, indx)=>(
                                          (res.id === pdf.start.id ? 
                                              <tr key={indx}>
                                                  <td>{pdf.start.id +1}</td>
                                                  <td>{pdf.start.name}</td>
                                                  <td>{pdf.end.name}</td>
                                                  <td>{pdf.distance}</td>
                                                  <td>{pdf.duration}</td>
                                              </tr>
                                              :
                                              null
                                          )
                                      ))}
                                  </tbody>
                              </table>
                          ))
                          : null
                        }
                      </Box>

                      {/* <Button colorScheme="red" mx={42}>
                        Load More
                      </Button> */}
                    </ModalBody>
                    <ModalFooter>
                      <Button colorScheme="blue" mr={3} onClick={modalForm.onClose}>
                        Close
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              )}
            </div>
          </HStack>
        </Box>
          <div>
              {modalTable.isOpen && (
                <Modal
                  size="full"
                  blockScrollOnMount={false}
                  isOpen={modalTable.isOpen}
                  onClose={modalTable.onClose}
                >
                  <ModalOverlay />
                  <ModalContent>
                    <ModalHeader justifyContent={center} textAlign={center}>
                      Pdf Cordinates Form
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <Box className="coordinates-form-container">

                      </Box>

                    </ModalBody>
                    <ModalFooter>
                      <Button colorScheme="blue" mr={3} onClick={modalTable.onClose}>
                        Close
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              )}
            </div>
          { loadingData ? 
            <Box position="fixed" left={0} top={0} h="100%" w="100%" backgroundColor="#000000b0" zIndex={99} display="flex" alignItems="center" justifyContent="center">
              <Spinner thickness='4px' speed='0.65s' emptyColor='gray' color='white' size='xl' />
            </Box>
            : null
          }
      </LoadScript>
    </Flex>
  );
}
export default Map;
