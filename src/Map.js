import React, { useRef, useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { useToast } from "@chakra-ui/react";
import { sortByDistance } from "sort-by-distance";
import { LoadScript,GoogleMap, Autocomplete } from "@react-google-maps/api";
import { Box, Button, ButtonGroup, Flex, HStack, IconButton, Input, Text, Select, Spinner, Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, useDisclosure, FormControl } from "@chakra-ui/react";
import { CloseButton } from "@chakra-ui/react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import {resetPdfData, retrievePdfData} from './actions/pdfdata'

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
  const [tableData, setTableData] = useState(null);
  const [file, setFile] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const dispatch = useDispatch();
  const {pdfItems, error} = useSelector((state) => state.pdfcontents);

  let totalDist = [];

  const [prevRoute, setPrevRoute] = React.useState([]);
  const [marker, setMarker] = React.useState([]);

  const modalTable = useDisclosure();
  const modalForm = useDisclosure();
  const [formData, setFormData] = React.useState([]);
  const inputRefs = useRef([]);

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
          const apiKey = process.env.REACT_APP_API_MAP_KEY;
          const response = await fetch(
            `${process.env.REACT_APP_API_MAP_URL}?latlng=${pos.lat},${pos.lng}&key=${apiKey}`
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
      setLoadingData(true);

      if (prevRoute.length) {
        prevRoute.forEach((prevRoute)=> {
          prevRoute.setMap(null);
        })
      }

      setDistance("");
      setDuration("");

      // It will calculate route between two points start / finish//
      const directionsService = new window.google.maps.DirectionsService();
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
      });

      var location_option = {
        origin: originRef.current.value,
        destination: destinationRef.current.value,
        provideRouteAlternatives: true,
        travelMode: window.google.maps.TravelMode.DRIVING,
      };

      await directionsService.route(
        location_option,
        (results, status) => {
          if (status === "OK") {
            // console.log(results)
            directionsRenderer.setDirections(results);
      
            setPrevRoute([directionsRenderer]);
      
            setLoadingData(false);
      
            setDistance(results.routes[0].legs[0].distance.text);
            setDuration(results.routes[0].legs[0].duration.text);

          } else {
           
            toast({
              description: "Directions request failed due to " + status,
              position: "top",
              status: "error",
              duration: 2500,
              isClosable: true,
            });
            setLoadingData(false);
          }
        }
      );
    }
   
    if (points) {

      // This alert for if pdf waypoint is more then 50 //
      if (points.length >= 50) {
        toast({
          description: "Please upload less then 50 waypoints...",
          position: "top",
          status: "error",
          duration: 1500,
          isClosable: true,
        });
      } else {

        if(error){
          toast({
            description: "Error: Please submit Correct Form data.",
            position: "top",
            status: "error",
            duration: 2500,
            isClosable: true,
          });
        } else {

          setLoadingData(true);

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
                    // window.alert("Directions request failed due to " + status);
                    console.log("Directions request failed due to " + status)
                    toast({
                      description: "Error: Please submit Correct Form Data.",
                      position: "top",
                      status: "error",
                      duration: 2500,
                      isClosable: true,
                    });
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
    setDuration(hours + " hrs and " + minutes + " mins.");
 
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
    
    setSelectedLocation("");
    
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
    setFile(event.target.value);
    if(file){
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async (e) => {
        axios({
          method: "post",
          url: process.env.REACT_APP_PDF_TEXT_URL,
          data: JSON.stringify({
            pdfFile: reader.result,
          }),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
        .then(function (response) {
          if (response.data) {
            setFormData(response.data);
            modalForm.onOpen();
            setLoadingData(false)
          }
        })
        .catch(function (response) {
          console.log(response);
          setLoadingData(false)
        });
      }
    } else {
      setLoadingData(false)
    }
    
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

  // Open coordinate table modal
  function openTableModal() {
    if(error){
      toast({
        description: "Error: Please submit Correct Form data.",
        position: "top",
        status: "error",
        duration: 2500,
        isClosable: true,
      });
    } else {

      if(points){
        modalTable.onOpen();
      } else {
        toast({
          description: "Error: Please submit Form Data First.",
          position: "top",
          status: "error",
          duration: 2500,
          isClosable: true,
        });
      }
    }
    
  }

  // Open coordinate form modal
  function openFormModal(){
    if(file){
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

  // Add form row function
  const addFormRow = () => {
    const newInputFields = [...formData];
    newInputFields.push({ 
      item_name: '', 
      item_price: '', 
      item_quantity: '', 
      item_cost: '', 
    });
    setFormData(newInputFields);
  }

  // Delete form row function
  const deleteFormRow = (index) => {
    if(formData.length >2 ){
      const newInputFields = [...formData];
      inputRefs.current["lng_"+index].classList.remove("focussed");
      inputRefs.current["lat_"+index].classList.remove("focussed");
      newInputFields.splice(index, 1);
      setFormData(newInputFields);
    }
  }

  // Location name change function
  const onLocationNameChange = (value, index) => {
    const newInputFields = [...formData];
    newInputFields[index].name = value;
    setFormData(newInputFields);
  }

  // Longitude change function
  const onLongitudeChange = (value, index) => {
    const newInputFields = [...formData];
    newInputFields[index].lng = value;
    if(isNaN(parseFloat(value))){
      inputRefs.current["lng_"+index].classList.add("focussed");
    } else {
      inputRefs.current["lng_"+index].classList.remove("focussed");
    }
    setFormData(newInputFields);
  }

  // Latitude change function
  const onLatitudeChange = (value, index) => {
    const newInputFields = [...formData];
    newInputFields[index].lat = value;

    if(isNaN(parseFloat(value))){
      inputRefs.current["lat_"+index].classList.add("focussed");
    } else {
      inputRefs.current["lat_"+index].classList.remove("focussed");
    }

    setFormData(newInputFields);
  }

  // Extra data change function
  const onExtraDataChange = (value, index) => {
    const newInputFields = [...formData];
    newInputFields[index].extra_data = value;
    setFormData(newInputFields);
  }

  // Longitude move value function
  const onLongitudeMove = (index) => {
    const newInputFields = [...formData];
    newInputFields[index].lng = newInputFields[index].lat;
    newInputFields[index].lat = newInputFields[index].extra_data;
    newInputFields[index].extra_data = "";
    // inputRefs.current["lng_"+index].classList.remove("focussed");
    if(isNaN(parseFloat(newInputFields[index].lng))){
      inputRefs.current["lng_"+index].classList.add("focussed");
    } else {
      inputRefs.current["lng_"+index].classList.remove("focussed");
    }
    setFormData(newInputFields);
  }

  // Latitude move value function
  const onLatitudeMove = (index) => {
    const newInputFields = [...formData];
    newInputFields[index].lat = newInputFields[index].extra_data;
    newInputFields[index].extra_data = "";
    // inputRefs.current["lat_"+index].classList.remove("focussed");
    if(isNaN(parseFloat(newInputFields[index].lat))){
      inputRefs.current["lat_"+index].classList.add("focussed");
    } else {
      inputRefs.current["lat_"+index].classList.remove("focussed");
    }
    setFormData(newInputFields);
  }

  // Form validate function
  const validateForm = (values) => {
    
    let errors = {};

    values.forEach((data, index) => {
      if(isNaN(parseFloat(data.lng))){

        errors.index = "Invalid Coordinates";
        inputRefs.current["lng_"+index].classList.add("focussed");
        inputRefs.current["lng_"+index].focus();

      } else {
        inputRefs.current["lng_"+index].classList.remove("focussed");
      }
      
      if(isNaN(parseFloat(data.lat))){
        errors.index = "Invalid Coordinates";
        inputRefs.current["lat_"+index].classList.add("focussed");
        inputRefs.current["lat_"+index].focus();
      } else {
        inputRefs.current["lat_"+index].classList.remove("focussed");
      }
    })

    if (Object.keys(errors).length === 0) {
      return true;
    } else {
      return false;
    }
  };

  // Location form submit function
  const handleFormSubmit = (event) => {
    if (event) event.preventDefault();

    if (validateForm(formData)) {

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

      dispatch(resetPdfData()).then((response)=>{
        let pointsArray = [];
        formData.forEach((data, index) => {
          pointsArray.push({"id": index, "name": data.name, "lng": parseFloat(data.lng), "lat": parseFloat(data.lat)})
        })

        updatePoints(pointsArray);
        setTableData(pointsArray);
        setSelectedLocation(JSON.stringify(pointsArray[0]));
        calculateDistancePath(pointsArray);
        modalForm.onClose();
      })

    }
    
  };

  return (
    <Flex position="relative" flexDirection="column" alignItems="center" h="100vh" w="100vw">
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_API_MAP_KEY}
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
          </GoogleMap>
        </Box>

        <Box p={4} borderRadius="lg" m={4} bgColor="white" shadow="base" minW="container.md" zIndex="1">
          <HStack spacing={2} justifyContent="space-between">
            <Box flexGrow={1}>
              <Autocomplete>
                <Input type="text" defaultValue={currentlocation} placeholder="Start" name="start_location" ref={originRef} />
              </Autocomplete>
            </Box>

            <Box flexGrow={1}>
              <Autocomplete>
                <Input type="text" placeholder="Finish" ref={destinationRef} name="destination_location" />
              </Autocomplete>
            </Box>

            <Box flexGrow={1}>
              <input key={fileInputKey} value={file} type="file" accept="application/pdf" name="pdf_file" onChange={extractText} />
            </Box>
            
            <ButtonGroup>
              <Button colorScheme="blue" type="submit" onClick={calculateRoute}>
                Calculate Route
              </Button>
              <IconButton aria-label="center back" icon={<FaTimes />} onClick={clearRoute} />
            </ButtonGroup>
          </HStack>

          <HStack spacing={2} mt={5} justifyContent="space-between">
            <Select flex={1} value={selectedLocation} onChange={(e) => handleCoordinateSelection(e.target.value)} name="coordinate_selection"
            >
              <option value="" disabled>Select location</option>
              {error ? null : tableData
                ? tableData.map((coordinate, index) => (
                    <option key={index} value={JSON.stringify(coordinate)}>
                      {coordinate.name}
                    </option>
                  ))
                : null}
            </Select>

            <Text flex={1} className="distance">Distance: {distance} </Text>
            <Text flex={1} className="distance">Duration: {duration} </Text>

            <Box display="flex" gap={2}>
              <Button onClick={openTableModal} colorScheme="black" variant="outline">
                Table Data
              </Button>

              <Button onClick={openFormModal} colorScheme="black" variant="outline">
                Form Data
              </Button>
            </Box>

          </HStack>
        </Box>

        <Box>
          {modalTable.isOpen && (
            <Modal size="full" blockScrollOnMount={false} isOpen={modalTable.isOpen} onClose={modalTable.onClose}>
              <ModalOverlay />
              <ModalContent>
                <ModalHeader className="text-center">
                  <h2 style={{fontSize: "xx-large"}}>Pdf Cordinates Table</h2>
                </ModalHeader>
                <ModalCloseButton fontSize="md" />

                <ModalBody>
                  <Box className="table-container">
                    {error ? null :
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
                                : null
                                )
                              ))}
                            </tbody>
                          </table>
                        ))
                      : null
                    }
                  </Box>
                </ModalBody>

                <ModalFooter>
                  <Button colorScheme="blue" mr={3} onClick={modalTable.onClose}>Close</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          )}
        </Box>
        <Box>
          {modalForm.isOpen && (
            <Modal size="full" blockScrollOnMount={false} isOpen={modalForm.isOpen} onClose={modalForm.onClose}>
              <ModalOverlay />
              <ModalContent>
                <ModalHeader className="text-center">
                  <h2 style={{fontSize: "xx-large"}}>Pdf Cordinates Form</h2>
                </ModalHeader>
                <ModalCloseButton fontSize="md" />
                
                <ModalBody>

                  <Box marginTop={0} marginBottom={10} className="text-center" display="flex" gap="10" justifyContent="end">
                    <Button colorScheme='green' type='button' onClick={() => addFormRow()}>Add Coordinate</Button>
                  </Box>

                  <Box className="coordinates-form-container">
                    {formData ?  
                      <form method="POST" id="coordinatesForm" onSubmit={handleFormSubmit}>
                        <table className="table-container" border="1">
                          <tbody>
                            <tr>
                              <th style={{width: "5%"}} className="text-center">S.No.</th>
                              <th style={{width: "30%"}} className="text-center">Location Name</th>
                              <th style={{width: "15%"}} className="text-center">Latitude</th>
                              <th style={{width: "15%"}} className="text-center">Longitude</th>
                              <th style={{width: "30%"}} className="text-center">Extra Data</th>
                              <th style={{width: "5%"}} className="text-center">Action</th>
                            </tr>
                                
                            {formData.map((data, index) => (
                              <tr key={index}>
                                <td className="text-center">{index+1}</td>
                                <td>
                                  <FormControl isRequired>
                                    <Input 
                                      type="text" 
                                      value={data['name']} 
                                      placeholder='Location Name' 
                                      name="location_name" 
                                      className="form-input" 
                                      onChange={(e) => onLocationNameChange(e.target.value, index)}
                                    />
                                  </FormControl>
                                </td>
                                <td>
                                  <FormControl isRequired>
                                    <Input 
                                      type="text" 
                                      value={data['lng']} 
                                      placeholder='Longitude' 
                                      name="longitude" 
                                      className="form-input" 
                                      ref={(el) => (inputRefs.current["lng_"+index] = el)}
                                      onChange={(e) => onLongitudeChange(e.target.value, index)}
                                    />
                                    {data['lng'] && /^[A-Za-z0-9]*$/.test(data['lng']) ? 
                                      <CloseButton size='sm' position="absolute" right={0} top={0} zIndex={1} onClick={() => onLongitudeMove(index)} />
                                    : null}
                                  </FormControl>
                                </td>
                                <td>
                                  <FormControl isRequired>
                                    <Input 
                                      type="text" 
                                      value={data['lat']} 
                                      placeholder='Latitude' 
                                      name="latitude" 
                                      className="form-input" 
                                      ref={(el) => (inputRefs.current["lat_"+index] = el)}
                                      onChange={(e) => onLatitudeChange(e.target.value, index)}
                                    />
                                    {data['lat'] && /^[A-Za-z0-9]*$/.test(data['lat']) ? 
                                      <CloseButton size='sm' position="absolute" right={0} top={0} zIndex={1} onClick={() => onLatitudeMove(index)} />
                                    : null}
                                  </FormControl>
                                </td>
                                <td>
                                  <FormControl>
                                    <Input 
                                      type="text" 
                                      value={data['extra_data']} 
                                      placeholder='Extra Data' 
                                      name="extra_data" 
                                      className="form-input" 
                                      onChange={(e) => onExtraDataChange(e.target.value, index)}
                                    />
                                  </FormControl>
                                </td>
                                <td className="text-center">
                                  <IconButton aria-label="center back" icon={<FaTimes />} onClick={() => deleteFormRow(index)} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <Box marginTop={5} className="text-center" display="flex" gap="10" justifyContent="center" bottom="0" zIndex={99} backgroundColor="white" padding="20px">
                          <Button colorScheme='blue' type='submit' width="20%" height={12}>Submit</Button>
                        </Box>
                            
                      </form>
                    : null}
                  </Box>

                </ModalBody>
              </ModalContent>
            </Modal>
          )}
        </Box>

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
