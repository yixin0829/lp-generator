import React from "react"
import Form from "react-bootstrap/Form"
import Button from "react-bootstrap/Button"
import { useState } from "react"

const GenerateLp = ({ onSubmit }) => {
  const [topic, setTopic] = useState("")

  // Submit form to fetch API
  const submitForm = (e) => {
    e.preventDefault()

    if (!topic) {
      alert("Please enter a string topic!")
      return
    }

    onSubmit(topic)
    setTopic("")
  }

  return (
    <Form onSubmit={submitForm}>
      <Form.Group className="mb-3" controlId="formTopic">
        <Form.Label>Topic you want to learn:</Form.Label>
        <Form.Control
          type="topic"
          placeholder="Enter topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </Form.Group>
      <Button variant="primary" type="submit">
        Submit
      </Button>
    </Form>
  )
}

export default GenerateLp
