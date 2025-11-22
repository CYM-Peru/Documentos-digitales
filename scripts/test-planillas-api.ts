// Script para probar el endpoint de planillas
async function testAPI() {
  try {
    const response = await fetch('http://localhost:3010/api/planillas-movilidad', {
      headers: {
        'Cookie': 'next-auth.session-token=test' // Esto fallará pero veremos el error
      }
    })

    console.log('Status:', response.status)
    const data = await response.json()
    console.log('Response:', JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error:', error)
  }
}

testAPI()
