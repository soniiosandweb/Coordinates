import { 
    PDFDATA,
    PDFERROR,
    RESETDATA
} from "./types";

export const retrievePdfData = (start, end) => async (dispatch) =>{
    try{
      
        const directionsService = new window.google.maps.DirectionsService();
        const results = await directionsService.route({
          origin: start,
          destination: end,
          provideRouteAlternatives: false,
            avoidFerries: false,
            avoidHighways: false,
            avoidTolls: false,
            unitSystem: window.google.maps.UnitSystem.METRIC,
            travelMode: window.google.maps.TravelMode.DRIVING,
        });

        const response = {"start" : start, "end" : end, "distance" : results.routes[0].legs[0].distance.text, "duration" : results.routes[0].legs[0].duration.text}

        dispatch({
            type: PDFDATA,
            payload: response
        })
        // console.log(results);
    }
    catch(err){
        dispatch( {
            type: PDFERROR,
            payload: err,
        })
        // console.log(err);
    }
}

export const resetPdfData = () => async (dispatch) =>{

    dispatch( {
        type: RESETDATA,
    })
}