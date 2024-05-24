import { combineReducers } from 'redux';
import pdfReducer from './pdfData';

export default combineReducers({
    pdfcontents: pdfReducer
})