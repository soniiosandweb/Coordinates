import React, { useEffect, useRef, useState, useCallback } from "react";
import "./Home.css";
import { Autocomplete, GoogleMap, LoadScript } from "@react-google-maps/api";
import {
  Box,
  Button,
  Input,
  Stack,
  useDisclosure,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  IconButton,
  Spinner,
  CloseButton,
} from "@chakra-ui/react";
import { MdKeyboardDoubleArrowRight } from "react-icons/md";
import { FaMapMarkerAlt, FaRegCircle } from "react-icons/fa";
import { BiTargetLock } from "react-icons/bi";
import { FaTimes } from "react-icons/fa";
import { FiUpload } from "react-icons/fi";
import { IoSearch } from "react-icons/io5";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { resetPdfData, retrievePdfData } from "../../actions/pdfdata";
import { sortByDistance } from "sort-by-distance";
import directionImg from "../../assests/images/get-directions-button.png";
import arrowsIcon from "../../assests/images/two-arrows.png";
import dotsIcon from "../../assests/images/dots-icon.png";

// Single-file cleaned & optimized Home component
const Home = () => {
  const toast = useToast();
  const dispatch = useDispatch();

  // UI state
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Map / location state
  const mapRef = useRef(null);
  const polylinesRef = useRef([]); // array of google.maps.Polyline
  const turnMarkersRef = useRef([]); // array of google.maps.Marker (turn/cue markers)
  const rendererRef = useRef([]); // for DirectionsRenderer instances (used for start/end markers where needed)

  const [center, setCenter] = useState(null);
  const [defaultCenter, setDefaultCenter] = useState(null);
  const [currentlocation, setCurrentLocation] = useState("");

  // route summary + UI
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [routesList, setRoutesList] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [latestDirectionsResults, setLatestDirectionsResults] = useState(null);

  // file / points / form
  const [file, setFile] = useState("");
  const [fileName, setFileName] = useState("");
  const originRef = useRef();
  const destinationRef = useRef();
  const fileInputKey = useRef();
  const searchDefaultRef = useRef();

  const [points, setPoints] = useState(null);
  const [formData, setFormData] = useState([]);
  const [tableData, setTableData] = useState(null);
  const inputRefs = useRef([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const { pdfItems, error } = useSelector((state) => state.pdfcontents || {});

  const modalTable = useDisclosure();
  const modalForm = useDisclosure();

  // utility: clear previous polylines, markers, renderers
  const clearMapObjects = useCallback(() => {
    // polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    // turn markers
    turnMarkersRef.current.forEach((m) => m.setMap(null));
    turnMarkersRef.current = [];

    // directions renderers
    rendererRef.current.forEach((r) => r.setMap(null));
    rendererRef.current = [];

    setRoutesList([]);
    setDistance("");
    setDuration("");
    setLatestDirectionsResults(null);
    setSelectedRouteIndex(0);
  }, []);

  // get user's geolocation once on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      toast({
        description: "Error: Your browser doesn't support geolocation.",
        position: "top",
        status: "error",
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCenter(pos);
        setDefaultCenter(pos);
      },
      (err) => {
        console.warn("geolocation error", err);
      }
    );
  }, [toast]);

  // helper: reverse geocode to human readable
  const geocodeLatLngToAddress = useCallback(async (latLng) => {
    return new Promise((resolve) => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: latLng }, (results, status) => {
          if (status === "OK" && results[0]) resolve(results[0].formatted_address);
          else resolve(null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }, []);

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
      const addr = await geocodeLatLngToAddress(pos);
      if (addr) {
        setCurrentLocation(addr);
        if (originRef.current) originRef.current.value = addr;
      }
    });
  };

  // --- Turn markers: create markers for a given route and keep them in ref ---
  const showTurnMarkers = (route) => {
    // remove old
    turnMarkersRef.current.forEach((m) => m.setMap(null));
    turnMarkersRef.current = [];

    if (!route || !route.legs || !route.legs[0]) return;

    const steps = route.legs[0].steps || [];

    steps.forEach((step, i) => {
      // place marker for first step, last step, or any with a maneuver
      if (step.maneuver || i === 0 || i === steps.length - 1) {
        const marker = new window.google.maps.Marker({
          position: step.start_location,
          map: mapRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#ffffff",
            fillOpacity: 1,
            strokeColor: "#0d53ff",
            strokeWeight: 2,
          },
        });

        const info = new window.google.maps.InfoWindow({
          content: `
            <div style="font-size:14px; max-width:240px">
              <strong>${step.instructions}</strong><br/>
              ${step.distance?.text || ""} • ${step.duration?.text || ""}
            </div>
          `,
        });

        marker.addListener("mouseover", () => info.open(mapRef.current, marker));
        marker.addListener("mouseout", () => info.close());

        turnMarkersRef.current.push(marker);
      }
    });
  };

  // --- draw polylines and wire click handlers ---
  const drawPolylinesForResults = (results) => {
    // clean first
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    results.routes.forEach((route, idx) => {
      const polyline = new window.google.maps.Polyline({
        path: route.overview_path,
        map: mapRef.current,
        strokeColor: "#0d53ff",
        strokeOpacity: idx === 0 ? 1 : 0.4,
        strokeWeight: idx === 0 ? 6 : 5,
        clickable: true,
      });

      polyline.addListener("click", () => {
        setSelectedRouteIndex(idx);
        // update visual
        polylinesRef.current.forEach((p, i) =>
          p.setOptions({ strokeOpacity: i === idx ? 1 : 0.4, strokeWeight: i === idx ? 6 : 5 })
        );

        // show markers for clicked route
        showTurnMarkers(route);

        // update distance/duration from clicked route
        if (route.legs && route.legs[0]) {
          setDistance(route.legs[0].distance.text);
          setDuration(route.legs[0].duration.text);
        }
      });

      polylinesRef.current.push(polyline);
    });
  };

  // --- render default start/end markers via DirectionsRenderer (suppresses polylines) ---
  const renderStartEndMarkers = (directionsResult) => {
    const renderer = new window.google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressPolylines: true,
      suppressMarkers: false,
    });
    renderer.setDirections(directionsResult);
    rendererRef.current.push(renderer);
  };

  // --- main calculateRoute (handles two-address mode and points mode) ---
  const calculateRoute = async () => {
    // if points (uploaded) exist -> compute multi-stop route
    if (points && points.length > 0) {
      // multi-stop mode (existing logic simplified & preserved)
      if (points.length >= 50) {
        toast({ description: "Please upload less than 50 waypoints...", position: "top", status: "error", duration: 1500, isClosable: true });
        return;
      }

      if (error) {
        toast({ description: "Error: Please submit Correct Form data.", position: "top", status: "error", duration: 2500, isClosable: true });
        return;
      }

      setLoadingData(true);
      clearMapObjects();

      // create numbered markers for stops
      const numberedMarkers = [];
      points.forEach((stop, i) => {
        const m = new window.google.maps.Marker({ position: { lat: stop.lat, lng: stop.lng }, map: mapRef.current, title: stop.name, label: { text: `${i + 1}`, color: "white" } });
        numberedMarkers.push(m);
      });

      // keep markers in turnMarkersRef temporarily so clearMapObjects removes them later
      turnMarkersRef.current = [...turnMarkersRef.current, ...numberedMarkers];

      // split into parts of 23 waypoints max and calculate each leg
      const max = 23;
      const parts = [];
      for (let a = 0; a < points.length; a += max) parts.push(points.slice(a, a + max));

      // calculate sequentially
      for (let b = 0; b < parts.length; b++) {
        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer({ draggable: false, map: mapRef.current, suppressMarkers: true });

        const waypoints = [];
        for (let j = 0; j < parts[b].length; j++) waypoints.push({ location: { lat: parts[b][j].lat, lng: parts[b][j].lng }, stopover: false });

        const origin = b === 0 ? (center || { lat: parts[0][0].lat, lng: parts[0][0].lng }) : { lat: parts[b - 1][parts[b - 1].length - 1].lat, lng: parts[b - 1][parts[b - 1].length - 1].lng };
        const destination = b === parts.length - 1 ? (center || { lat: parts[0][0].lat, lng: parts[0][0].lng }) : { lat: parts[b][parts[b].length - 1].lat, lng: parts[b][parts[b].length - 1].lng };

        const serviceOptions = { origin, destination, waypoints, optimizeWaypoints: true, provideRouteAlternatives: true, travelMode: window.google.maps.TravelMode.DRIVING, unitSystem: window.google.maps.UnitSystem.METRIC };

        // wrap callback style in a Promise so we can await
        await new Promise((resolve) => {
          directionsService.route(serviceOptions, (response, status) => {
            if (status === "OK") {
              directionsRenderer.setDirections(response);
              // keep renderer so it can be cleared later
              rendererRef.current.push(directionsRenderer);
              // compute and collect distances
              computeTotalDistanceNew(response);
              resolve();
            } else {
              toast({ description: "Error: Directions request failed due to " + status, position: "top", status: "error", duration: 2500, isClosable: true });
              resolve();
            }
          });
        });
      }

      setLoadingData(false);
      return;
    }

    // 2-address mode
    if ((!originRef.current?.value || !destinationRef.current?.value) && (!points || points.length === 0)) {
      toast({ description: "Please fill Start and Finish location both Or Upload Pdf..", position: "top", status: "error", duration: 1500, isClosable: true });
      return;
    }

    setLoadingData(true);
    clearMapObjects();

    // use cached or create directionsService
    const directionsService = new window.google.maps.DirectionsService();

    const request = { origin: originRef.current.value, destination: destinationRef.current.value, provideRouteAlternatives: true, travelMode: window.google.maps.TravelMode.DRIVING };

    directionsService.route(request, (results, status) => {
      if (status !== "OK") {
        toast({ description: "Directions request failed due to " + status, position: "top", status: "error", duration: 2500, isClosable: true });
        setLoadingData(false);
        return;
      }

      setLatestDirectionsResults(results);

      // set routesList (simple summary)
      const extractedRoutes = results.routes.map((route, index) => ({ index, distance: route.legs[0].distance.text, duration: route.legs[0].duration.text, summary: route.summary }));
      setRoutesList(extractedRoutes);

      // render start/end markers using DirectionsRenderer (suppresses polylines)
      renderStartEndMarkers(results);

      // draw polylines and wire clicks
      drawPolylinesForResults(results);

      // default: show markers for first route and set distance/duration
      if (results.routes && results.routes[0]) {
        showTurnMarkers(results.routes[0]);
        setDistance(results.routes[0].legs[0].distance.text);
        setDuration(results.routes[0].legs[0].duration.text);
        setSelectedRouteIndex(0);
      }

      setLoadingData(false);
    });
  };

  // --- geocode helper for PDF coordinates ---
  const geocodeAddress = (address) =>
    new Promise((resolve) => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address }, (results, status) => {
          if (status === "OK" && results[0]) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng(), formatted: results[0].formatted_address });
          } else {
            resolve(null);
          }
        });
      } catch (e) {
        resolve(null);
      }
    });

  const getCoordinatesData = async (coordinateData) => {
    for (const element of coordinateData) {
      if (element.lng === "" && element.lat === "") {
        const geo = await geocodeAddress(element.name);
        if (geo) {
          element.lat = geo.lat;
          element.lng = geo.lng;
        }
      }

      if (element.lng !== "" && isNaN(parseFloat(element.lng))) {
        element.name += " " + element.lng;
        element.lng = element.lat;
        element.lat = element.extra_data;
        element.extra_data = "";
      }
    }

    return coordinateData;
  };

  // shorter updatePoints implementation (nearest neighbor)
  const updatePoints = (pts) => {
    if (!pts || pts.length === 0) return;
    setCenter(null);
    const opts = { yName: "lat", xName: "lng", type: "linear" };
    const currentPath = [pts[0]];
    let remaining = pts.slice(1);
    while (remaining.length > 0) {
      const next = sortByDistance(currentPath[currentPath.length - 1], remaining, opts)[0];
      currentPath.push(next);
      remaining = remaining.filter((p) => p !== next);
    }

    setPoints(currentPath);
  };

  // compute distance for multi-leg PDF results
  let totalDistAccumulator = useRef([]);
  const computeTotalDistanceNew = (result) => {
    if (result) {
      totalDistAccumulator.current.push(result);
      computeTotalDistance(totalDistAccumulator.current);
    }
  };

  const computeTotalDistance = (results) => {
    let totalDist = 0;
    let totalTime = 0;
    results.forEach((result) => {
      const myroute = result.routes[0];
      for (let i = 0; i < myroute.legs.length; i++) {
        totalDist += myroute.legs[i].distance.value;
        totalTime += myroute.legs[i].duration.value;
      }
    });

    totalDist = totalDist / 1000;
    const hours = Math.floor(totalTime / 3600);
    const minutes = Math.floor((totalTime % 3600) / 60);

    setDistance(totalDist + " km");
    setDuration(hours + " hrs and " + minutes + " mins.");
  };

  // PDF extract
  const extractText = (event) => {
    setDistance("");
    setDuration("");
    clearMapObjects();
    setLoadingData(true);

    const f = event.target.files[0];
    if (!f) {
      setLoadingData(false);
      return;
    }
    setFileName(f.name);
    setFile(event.target.value);

    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = async () => {
      try {
        const response = await axios({ method: "post", url: process.env.REACT_APP_PDF_TEXT_URL, data: JSON.stringify({ pdfFile: reader.result }), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        if (response.data) {
          const coords = await getCoordinatesData(response.data);
          setFormData(coords);
          modalForm.onOpen();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
  };

  // form helpers (same logic, cleaned)
  const addFormRow = () => setFormData((f) => [...f, { item_name: "", item_price: "", item_quantity: "", item_cost: "" }]);

  const deleteFormRow = (index) => {
    if (formData.length <= 2) return;
    const copy = [...formData];
    inputRefs.current["lng_" + index]?.classList?.remove("focussed");
    inputRefs.current["lat_" + index]?.classList?.remove("focussed");
    copy.splice(index, 1);
    setFormData(copy);
  };

  const onLocationNameChange = (value, index) => {
    const copy = [...formData];
    copy[index].name = value;
    setFormData(copy);
  };

  const onLongitudeChange = (value, index) => {
    const copy = [...formData];
    copy[index].lng = value;
    if (isNaN(parseFloat(value))) inputRefs.current["lng_" + index]?.classList?.add("focussed");
    else inputRefs.current["lng_" + index]?.classList?.remove("focussed");
    setFormData(copy);
  };

  const onLatitudeChange = (value, index) => {
    const copy = [...formData];
    copy[index].lat = value;
    if (isNaN(parseFloat(value))) inputRefs.current["lat_" + index]?.classList?.add("focussed");
    else inputRefs.current["lat_" + index]?.classList?.remove("focussed");
    setFormData(copy);
  };

  const onExtraDataChange = (value, index) => {
    const copy = [...formData];
    copy[index].extra_data = value;
    setFormData(copy);
  };

  const onLongitudeMove = (index) => {
    const copy = [...formData];
    copy[index].lng = copy[index].lat;
    copy[index].lat = copy[index].extra_data;
    copy[index].extra_data = "";
    if (isNaN(parseFloat(copy[index].lng))) inputRefs.current["lng_" + index]?.classList?.add("focussed");
    else inputRefs.current["lng_" + index]?.classList?.remove("focussed");
    setFormData(copy);
  };

  const onLatitudeMove = (index) => {
    const copy = [...formData];
    copy[index].lat = copy[index].extra_data;
    copy[index].extra_data = "";
    if (isNaN(parseFloat(copy[index].lat))) inputRefs.current["lat_" + index]?.classList?.add("focussed");
    else inputRefs.current["lat_" + index]?.classList?.remove("focussed");
    setFormData(copy);
  };

  const validateForm = (values) => {
    let errors = {};
    values.forEach((data, index) => {
      if (isNaN(parseFloat(data.lng))) {
        errors.index = "Invalid Coordinates";
        inputRefs.current["lng_" + index]?.classList?.add("focussed");
        inputRefs.current["lng_" + index]?.focus();
      } else inputRefs.current["lng_" + index]?.classList?.remove("focussed");

      if (isNaN(parseFloat(data.lat))) {
        errors.index = "Invalid Coordinates";
        inputRefs.current["lat_" + index]?.classList?.add("focussed");
        inputRefs.current["lat_" + index]?.focus();
      } else inputRefs.current["lat_" + index]?.classList?.remove("focussed");
    });
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (event) => {
    if (event) event.preventDefault();
    if (!validateForm(formData)) return;

    setDistance("");
    setDuration("");
    clearMapObjects();

    dispatch(resetPdfData()).then(() => {
      const pointsArray = formData.map((data, idx) => ({ id: idx, name: data.name, lng: parseFloat(data.lng), lat: parseFloat(data.lat) }));
      updatePoints(pointsArray);
      setTableData(pointsArray);
      setSelectedRouteIndex(0);
      calculateDistancePath(pointsArray);
      modalForm.onClose();
    });
  };

  // table drag/drop
  const handleDragStart = (e, index) => { setDraggedIndex(index); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const rows = [...formData];
    const [moved] = rows.splice(draggedIndex, 1);
    rows.splice(targetIndex, 0, moved);
    setFormData(rows);
    setDraggedIndex(null);
  };

  // calculate distance between each pair for table
  const calculateDistancePath = (data) => data.forEach((el) => calculateRoutePath(el, data));
  const calculateRoutePath = (element, data) => data.forEach((ele) => dispatch(retrievePdfData(element, ele)));

  // UI helpers
  const clearRoute = () => {
    setDistance("");
    setDuration("");
    clearMapObjects();
    if (originRef.current) originRef.current.value = "";
    if (destinationRef.current) destinationRef.current.value = "";
    setFile("");
    setFileName("");
    setPoints(null);
    setTableData(null);
  };

  const handleCloseSidebar = () => { clearRoute(); setShowSidebar(false); };
  const handleOpenSidebar = () => { setShowSidebar(true); if (searchDefaultRef.current) searchDefaultRef.current.value = ""; };

  const handleDefaultSearch = () => {
    if (!searchDefaultRef.current || searchDefaultRef.current.value === "") {
      toast({ description: "Please search location!", position: "top", status: "error", duration: 1500, isClosable: true });
      return;
    }
    setCurrentLocation(searchDefaultRef.current.value);
    if (originRef.current) originRef.current.value = searchDefaultRef.current.value;
    handleOpenSidebar();
  };

  const handleReverseLocation = () => {
    if (!originRef.current || !destinationRef.current) return;
    if (originRef.current.value !== "" && destinationRef.current.value === "") {
      destinationRef.current.value = originRef.current.value; originRef.current.value = ""; originRef.current.focus();
    } else if (originRef.current.value === "" && destinationRef.current.value !== "") {
      originRef.current.value = destinationRef.current.value; destinationRef.current.value = ""; destinationRef.current.focus();
    } else if (originRef.current.value !== "" && destinationRef.current.value !== "") {
      const s = originRef.current.value; const e = destinationRef.current.value;
      setCurrentLocation(e); originRef.current.value = e; destinationRef.current.value = s;
    }
  };

  const handleSelectRoute = (index) => {
    setSelectedRouteIndex(index);
    // visually highlight polylines
    polylinesRef.current.forEach((p, i) => p.setOptions({ strokeOpacity: i === index ? 1 : 0.4, strokeWeight: i === index ? 6 : 5 }));
    // show turn markers for selected route (if we have latest results)
    if (latestDirectionsResults && latestDirectionsResults.routes && latestDirectionsResults.routes[index]) showTurnMarkers(latestDirectionsResults.routes[index]);
  };

  // render
  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_API_MAP_KEY} libraries={["places"]}>
      <div className="home_page_block">

        <div className={`searchbar_input ${showSidebar ? "hide" : "show"}`}>
          <div className="default_search_input">
            <Autocomplete onPlaceChanged={handleDefaultSearch}>
              <Input type="text" placeholder="Search" id="search_location" name="search_location" ref={searchDefaultRef} />
            </Autocomplete>
            <IoSearch onClick={() => handleDefaultSearch()} />
          </div>
          <Button className="sidebar_open_btn" onClick={() => handleOpenSidebar()}>
            <img src={directionImg} alt="Direction" />
          </Button>
        </div>

        <div className={`home_sidebar_block ${showSidebar ? "show" : "hide"}`}>
          <Button className="sidebar_close_btn" onClick={() => handleCloseSidebar()}>
            <MdKeyboardDoubleArrowRight />
          </Button>

          <div className="sidebar_box_div">
            <div className="sidebar_box_columns">
              <p className="sidebar_heading">"A smarter way to navigate — real-time routes</p>

              <Stack direction={["column"]} spacing={3}>
                <Box flexGrow={1} className="input_rows_block">
                  <div className="input_rows">
                    <FaRegCircle className="input_icon" />
                    <Autocomplete>
                      <Input type="text" defaultValue={currentlocation} placeholder="Choose Starting Point" name="start_location" ref={originRef} />
                    </Autocomplete>
                  </div>

                  <div className="input_rows location_middle">
                    <span className="arrows_dots"><img src={dotsIcon} alt="Dots" className="arrows_dots_icons" /></span>
                    <p className="your_location_txt" onClick={() => getCurrentLocation()}><BiTargetLock /> Your Location</p>
                    <img src={arrowsIcon} alt="Arrows" className="arrows_icons" onClick={() => handleReverseLocation()} />
                  </div>

                  <div className="input_rows">
                    <FaMapMarkerAlt className="input_icon location" />
                    <Autocomplete>
                      <Input type="text" placeholder="Choose Destination" ref={destinationRef} name="destination_location" />
                    </Autocomplete>
                  </div>
                </Box>

                <Box flexGrow={1}><p className="sidebar_heading middle_text">Or</p></Box>

                <Box flexGrow={1} className="file_box">
                  <div className="file_box_content">
                    <input key={fileInputKey} className="form_file_upload" value={file} type="file" accept="application/pdf" name="pdf_file" onChange={extractText} hidden id="actual-btn" />
                    <label htmlFor="actual-btn"><FiUpload /> Upload File</label>
                    <span className="line_files"></span>
                    <span id="file-chosen">{fileName ? fileName : "No file chosen"}</span>
                  </div>
                  <p className="file_helper">Have multiple stops? Upload a PDF file!</p>
                </Box>

                <Button className="calculate_route" type="submit" onClick={calculateRoute}>Calculate Route</Button>

                <Box display="flex" gap={3} className="table_form_btns">
                  <Button onClick={() => { if (points) modalTable.onOpen(); else toast({ description: "Error: Please submit Form Data First.", position: "top", status: "error", duration: 2500, isClosable: true }); }} className="table_form_data" variant="outline">Table Data</Button>
                  <Button onClick={() => { if (file) modalForm.onOpen(); else toast({ description: "Error: Please upload PDF.", position: "top", status: "error", duration: 2500, isClosable: true }); }} className="table_form_data" variant="outline">Form Data</Button>
                </Box>
              </Stack>
            </div>

            <div className="sidebar_box_columns border-top">
              {routesList && routesList.length >= 1 ? (
                routesList.map((r) => (
                  <div key={r.index} onClick={() => handleSelectRoute(r.index)} style={{ 
                      padding: "10px", 
                      cursor: "pointer", 
                      marginBottom: "10px", 
                      // background: selectedRouteIndex === r.index ? "#0d53ff" : "#fff", 
                      color: selectedRouteIndex === r.index ? "#0d53ff" : "#000", 
                      // border: selectedRouteIndex === r.index ? "1px solid #0d53ff" : "none"
                    }}>
                    <strong>{r.summary}</strong><br /> {r.distance} — {r.duration}
                  </div>
                ))
              ) : (
                <>
                  <p className="sidebar_heading">"Expect delays due to heavy traffic ahead."</p>
                  <p className="file_helper">No known road disruptions. Traffic incidents will show up here.</p>
                  {distance && <p className="sidebar_heading">Distance: {distance}</p>}
                  {duration && <p className="sidebar_heading">Duration: {duration}</p>}
                </>
              )}

              
            </div>
          </div>
        </div>

        <div className="map_content_view">
          <GoogleMap center={defaultCenter} zoom={8} mapContainerStyle={{ width: "100%", height: "100%" }} options={{ zoomControl: true, streetViewControl: false, mapTypeControl: false }} onLoad={(map) => { mapRef.current = map; }} onUnmount={() => { mapRef.current = null; clearMapObjects(); }}>
          </GoogleMap>
        </div>
      </div>

      {/* Table Modal */}
      {modalTable.isOpen && (
        <Modal size="full" blockScrollOnMount={false} isOpen={modalTable.isOpen} onClose={modalTable.onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader className="text-center"><h2 style={{ fontSize: "xx-large" }}>Pdf Cordinates Table</h2></ModalHeader>
            <ModalCloseButton fontSize="md" />
            <ModalBody>
              <Box className="table-container">
                {error ? null : tableData && pdfItems ? tableData.map((res, index) => (
                  <table key={index} border="1">
                    <tbody>
                      <tr>
                        <th style={{ width: "10%" }}>S.no</th>
                        <th style={{ width: "30%" }}>Start</th>
                        <th style={{ width: "30%" }}>Finish</th>
                        <th style={{ width: "15%" }}>Distance</th>
                        <th style={{ width: "15%" }}>Duration</th>
                      </tr>
                      {pdfItems.map((pdf, indx) => (res.id === pdf.start.id ? (
                        <tr key={indx}>
                          <td>{pdf.start.id + 1}</td>
                          <td>{pdf.start.name}</td>
                          <td>{pdf.end.name}</td>
                          <td>{pdf.distance}</td>
                          <td>{pdf.duration}</td>
                        </tr>
                      ) : null))}
                    </tbody>
                  </table>
                )) : null}
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={modalTable.onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* Form Modal */}
      {modalForm.isOpen && (
        <Modal size="full" blockScrollOnMount={false} isOpen={modalForm.isOpen} onClose={modalForm.onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader className="text-center"><h2 style={{ fontSize: "xx-large" }}>Pdf Cordinates Form</h2></ModalHeader>
            <ModalCloseButton fontSize="md" />
            <ModalBody>
              <Box marginTop={0} marginBottom={10} className="text-center" display="flex" gap="10" justifyContent="end">
                <Button colorScheme='green' type='button' onClick={() => addFormRow()}>Add Coordinate</Button>
              </Box>

              <Box className="coordinates-form-container">
                {formData ? (
                  <form method="POST" id="coordinatesForm" onSubmit={handleFormSubmit}>
                    <div className="coordinatesForm">
                      <table className="table-container" border="1">
                        <tbody>
                          <tr>
                            <th style={{ width: "5%" }} className="text-center">S.No.</th>
                            <th style={{ width: "30%" }} className="text-center">Location Name</th>
                            <th style={{ width: "15%" }} className="text-center">Longitude</th>
                            <th style={{ width: "15%" }} className="text-center">Latitude</th>
                            <th style={{ width: "30%" }} className="text-center">Extra Data</th>
                            <th style={{ width: "5%" }} className="text-center">Action</th>
                          </tr>

                          {formData.map((data, index) => (
                            <tr key={index} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)} style={{ cursor: "move", background: draggedIndex === index ? "#f0f0f0" : "white" }}>
                              <td className="text-center">{index + 1}</td>
                              <td>
                                <FormControl isRequired>
                                  <Input type="text" value={data['name'] || ''} placeholder='Location Name' name="location_name" className="form-input" onChange={(e) => onLocationNameChange(e.target.value, index)} />
                                </FormControl>
                              </td>
                              <td>
                                <FormControl isRequired>
                                  <Input type="text" value={data['lng'] || ''} placeholder='Longitude' name="longitude" className="form-input" ref={(el) => (inputRefs.current["lng_" + index] = el)} onChange={(e) => onLongitudeChange(e.target.value, index)} />
                                  {data['lng'] && /^[A-Za-z0-9]*$/.test(String(data['lng'])) ? <CloseButton size='sm' position="absolute" right={0} top={0} zIndex={1} onClick={() => onLongitudeMove(index)} /> : null}
                                </FormControl>
                              </td>
                              <td>
                                <FormControl isRequired>
                                  <Input type="text" value={data['lat'] || ''} placeholder='Latitude' name="latitude" className="form-input" ref={(el) => (inputRefs.current["lat_" + index] = el)} onChange={(e) => onLatitudeChange(e.target.value, index)} />
                                  {data['lat'] && /^[A-Za-z0-9]*$/.test(String(data['lat'])) ? <CloseButton size='sm' position="absolute" right={0} top={0} zIndex={1} onClick={() => onLatitudeMove(index)} /> : null}
                                </FormControl>
                              </td>
                              <td>
                                <FormControl>
                                  <Input type="text" value={data['extra_data'] || ''} placeholder='Extra Data' name="extra_data" className="form-input" onChange={(e) => onExtraDataChange(e.target.value, index)} />
                                </FormControl>
                              </td>
                              <td className="text-center"><IconButton aria-label="center back" icon={<FaTimes />} onClick={() => deleteFormRow(index)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Box marginTop={5} className="text-center" display="flex" gap="10" justifyContent="center" bottom="0" zIndex={99} backgroundColor="white" padding="20px">
                      <Button colorScheme='blue' type='submit' maxWidth="20%" height={12}>Submit</Button>
                    </Box>
                  </form>
                ) : null}
              </Box>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      {loadingData ? (
        <Box position="fixed" left={0} top={0} h="100%" w="100%" backgroundColor="#000000b0" zIndex={99} display="flex" alignItems="center" justifyContent="center">
          <Spinner thickness='4px' speed='0.65s' emptyColor='gray' color='white' size='xl' />
        </Box>
      ) : null}
    </LoadScript>
  );
};

export default Home;

