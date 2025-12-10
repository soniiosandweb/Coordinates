import React from 'react'
import { BrowserRouter , Routes , Route } from 'react-router-dom';
import Mark from './Mark'
import Layout from './Layout';
import Backup from './Backup'
import Map from './Map';
import New from './components/New';
// import Home from './components/Home/Home';
import Home from "./components/Home/HomeLatest";

function App() {
  return (
    <BrowserRouter basename='/maproute'>

    <Routes>

      <Route path="/" element={<Layout />}>
        <Route index element={<Home/>} />
        <Route path="mark" element={<Mark />} />
        <Route path="backup" element={<Backup />} />
        <Route path="map" element={<Map />} />
        <Route path="new" element={<New />} />
        <Route path="home" element={<Home />} />
        <Route path="*" element={<Home/>} />
      </Route>

    </Routes>
  </BrowserRouter>
  )
}

export default App
