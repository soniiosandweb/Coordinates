import React from 'react'
import { BrowserRouter , Routes , Route } from 'react-router-dom';
import Mark from './Mark'
import Test from './Test'
import Layout from './Layout';
import Backup from './Backup'
import Map from './Map';
import New from './components/New';

function App() {
  return (
    <BrowserRouter basename='/maproute'>

    <Routes>

      <Route path="/" element={<Layout />}>
        <Route index element={<Map/>} />
        <Route path="mark" element={<Mark />} />
        <Route path="backup" element={<Backup />} />
        <Route path="map" element={<Map />} />
        <Route path="test" element={<Test />} />
        <Route path="new" element={<New />} />
      </Route>

    </Routes>
  </BrowserRouter>
  )
}

export default App
