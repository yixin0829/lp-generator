def generate_prompt(topic:str):
    """
    Helper to generate the prompt as input to OpenAI's completions endpoint.
    Input topic is any string key phrase to generate learning path for (e.g. React, Fishing)
    """

    return """Task: Generate a list of key concepts for learning a topic grouped by beginner, intermediate, advanced levels and output the result in JSON format.

Output for learning Angular:
{{
"Beginner": ["Modules", "Components", "Data Binding", "Directives", "Routing", "Forms", "Pipes", "Services"],
"Intermediate": ["Dependency Injection", "HTTP Requests", "Change Detection", "Angular CLI", "State Management", "Unit Testing"],
"Advanced": ["Web Workers", "Dynamic Components", "Optimizing Performance", "Angular Universal", "Advanced Routing", "Progressive Web Apps"]
}}

Output for learning {}:""".format(topic.capitalize())
