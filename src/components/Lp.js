import React from 'react'

const Lp = ({ lpData, topic }) => {
  const listBeginner = lpData.Beginner.map((concept, index) => {
    return <li key={index}>{concept}</li>
  })
  const listIntermediate = lpData.Intermediate.map((concept, index) => {
    return <li key={index}>{concept}</li>
  })
  const listAdvanced = lpData.Advanced.map((concept, index) => {
    return <li key={index}>{concept}</li>
  })

  return (
    <div>
        <h3>Learning Path Result for <mark>{topic}</mark></h3>
        <h4>Beginner:</h4>
        <ul>{listBeginner}</ul>
        <h4>Intermediate:</h4>
        <ul>{listIntermediate}</ul>
        <h4>Advanced:</h4>
        <ul>{listAdvanced}</ul>
    </div>
  )
}

export default Lp