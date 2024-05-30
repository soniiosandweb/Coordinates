import { 
    PDFDATA,
    PDFERROR,
    RESETDATA
} from "../actions/types";

const initialState = {
    pdfItems: []
};

function pdfReducer(state = initialState, action){
    const {type, payload} = action;

    switch (type){

        case PDFDATA:
            return {
                ...state,
                pdfItems: [payload, ...state.pdfItems].sort((a,b)=>b.end.id === a.end.id ? 0 : a.end.id > b.end.id ? 1 : -1)
            }
        
        case PDFERROR:
            return{
                ...state,
                error: payload
            }
        
        case RESETDATA:
            return initialState
            
        default:
            return state;
    }
}

export default pdfReducer;