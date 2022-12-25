import Form from "react-bootstrap/Form"
import Button from 'react-bootstrap/Button';

const FormComponent = () => {

  const submitForm = () => {
    fetch('http://127.0.0.1:8000/v1/lp/React')
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(error => console.error(error));
  }

  return (
    <Form>
      <Form.Group className="mb-3" controlId="formTopic">
        <Form.Label>Topic you want to learn:</Form.Label>
        <Form.Control type="topic" placeholder="Enter topic" />
        <Form.Text className="text-muted">
        We'll never share your data with anyone else.
        </Form.Text>
      </Form.Group>
      <Button variant="primary" type="submit" onClick={ submitForm }>
        Submit
      </Button>
    </Form>
  )
}

export default FormComponent