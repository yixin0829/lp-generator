import { useState } from "react"
import GenerateLp from "./components/GenerateLp"
import Lp from "./components/Lp"

function App() {
  const [lp, setLp] = useState({})
  const [topic, setTopic] = useState("")

  const generateLp = async (topic) => {
    fetch(`http://127.0.0.1:8000/v1/lp/${topic}`)
      .then((response) => response.json())
      .then((data) => {
        setLp(data.completion)
        setTopic(data.topic)
        console.log(data.completion)
      })
      .catch((error) => console.error(error))
  }

  return (
    <div className="App">
      <h1>Learning Path Generator</h1>
      <GenerateLp onSubmit={generateLp} />
      {Object.keys(lp).length > 0 ? (
        <Lp lpData={lp} topic={topic}/>
      ) : (
        <h3>No learning path generated.</h3>
      )}
    </div>
  )
}

export default App
