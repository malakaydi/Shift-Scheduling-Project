const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const cors = require('cors');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');


const employeeProtoPath = '../Employee/employee.proto';
const jobPlanningProtoPath = '../JobPlanning/jobPlanning.proto';
const alerteMsgProtoPath = '../Alertes/alerteMsg.proto';
const resolvers = require('./resolvers');
const typeDefs = require('./schema');

// Create a new Express application
const app = express();
const employeeProtoDefinition = protoLoader.loadSync(employeeProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const jobPlanningProtoDefinition = protoLoader.loadSync(jobPlanningProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const alerteMsgProtoDefinition = protoLoader.loadSync(alerteMsgProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
app.use(bodyParser.json());
const employeeProto = grpc.loadPackageDefinition(employeeProtoDefinition).employee;
const jobPlanningProto = grpc.loadPackageDefinition(jobPlanningProtoDefinition).jobPlanning;
const alerteMsgProto = grpc.loadPackageDefinition(alerteMsgProtoDefinition).alerteMsg;

const kafka = new Kafka({
    clientId: 'my-app',
    brokers: ['localhost:9092'] 
});

const consumer = kafka.consumer({ groupId: 'api-gateway-consumer' });

consumer.subscribe({ topic: 'employee-topic' });
consumer.subscribe({ topic: 'job-planning-topic' });
consumer.subscribe({ topic: 'alerte-msg-topic' });

(async () => {
    await consumer.connect();
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log(`Received message: ${message.value.toString()}, from topic: ${topic}`);
        },
    });
})();


const server = new ApolloServer({ typeDefs, resolvers });

server.start().then(() => {
    app.use(
        cors(),
        bodyParser.json(),
        expressMiddleware(server),
    );
});

app.get('/employee', (req, res) => {
    const client = new employeeProto.EmployeeService('localhost:50053',
        grpc.credentials.createInsecure());
    client.searchEmployees({}, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(response.employees);
        }
    });
});

app.get('/employee/:id', (req, res) => {
    const client = new employeeProto.EmployeeService('localhost:50053',
        grpc.credentials.createInsecure());
    const id = req.params.id;
    client.getEmployee({ employee_id: id }, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(response.employee);
        }
    });
});

app.post('/employee/add', (req, res) => {
    const client = new employeeProto.EmployeeService('localhost:50053',
        grpc.credentials.createInsecure());
    const data = req.body;
    const firstName=data.firstName;
    const lastName= data.lastName;
    const phoneNumber= data.phoneNumber;
    const email= data.email;
    const position= data.position;
    client.addEmployee({ firstName: firstName,lastName:lastName,  phoneNumber:phoneNumber,email:email,position:position}, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(response.employee);
        }
    });
});

app.delete('/employee/:id', (req, res) => {
    const client = new employeeProto.EmployeeService('localhost:50053',
        grpc.credentials.createInsecure());
    const id = req.params.id;
    client.deleteEmployee({ employee_id: id }, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json({ message: 'Employee deleted successfully' });
        }
    });
});




app.get('/jobPlanning', (req, res) => {
    const client = new jobPlanningProto.JobPlanningService('localhost:50052',
        grpc.credentials.createInsecure());
    client.SearchJobPlannings({}, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(response.job_plannings);
        }
    });
});

app.get('/jobPlanning/:id', (req, res) => {
    const client = new jobPlanningProto.JobPlanningService('localhost:50052',
        grpc.credentials.createInsecure());
    const id = req.params.id;
    client.GetJobPlanning({ job_planning_id: id }, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(response.job_planning);
        }
    });
});

app.post('/jobPlanning/add', (req, res) => {
    const client = new jobPlanningProto.JobPlanningService('localhost:50052',
        grpc.credentials.createInsecure());
    const data = req.body;
    const employee_name=data.employee_name;
    const position=data.position;
    const startDate=data.startDate;
    const endDate=data.endDate;
    
    client.AddJobPlanning({ employee_name:employee_name,position: position,startDate:startDate, endDate:endDate}, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(response.job_planning);
        }
    });
});

app.delete('/jobPlanning/:id', (req, res) => {
    const client = new jobPlanningProto.JobPlanningService(
      'localhost:50052',
      grpc.credentials.createInsecure()
    );
    const id = req.params.id;
    client.DeleteJobPlanning({ job_planning_id: id }, (err, response) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.json({ message: 'Job planning deleted successfully' });
      }
    });
  });


app.post('/alerteMsg/send', (req, res) => {
    const client = new alerteMsgProto.AlerteMsgService('localhost:50055',
        grpc.credentials.createInsecure());
    const data = req.body;
    const recipient=data.recipient;
    const message=data.message
    client.SendAlerteMsg({ recipient: recipient,message:message}, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(response.confirmation);
        }
    });
});

app.put('/alerteMsg/update/:id', (req, res) => {
    const client = new alerteMsgProto.AlerteMsgService(
        'localhost:50055',
        grpc.credentials.createInsecure()
    );
    const { id } = req.params;
    const { message, recipient } = req.body;
    client.UpdateAlerteMsg({ id, message, recipient }, (err, response) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json({ confirmation: response.confirmation || "Alert message updated successfully" });
        }
    });
});




const port = 3000;
app.listen(port, () => {
    console.log(`API Gateway is running on port ${port}`);
});
