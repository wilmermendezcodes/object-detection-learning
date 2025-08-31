import React from 'react'
import TopBar from './components/TopBar.jsx'
import DetectorView from './components/DetectorView.jsx'
import ControlsPanel from './components/ControlsPanel.jsx'
import ResultsPanel from './components/ResultsPanel.jsx'

export default function App() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        <DetectorView />
        <div className="border-l">
          <ControlsPanel />
          <ResultsPanel />
        </div>
      </div>
    </div>
  )
}
