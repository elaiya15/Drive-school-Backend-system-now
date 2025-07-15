import axios from 'axios';



export const sendSMS = async (otp, phoneNumbers) => {
    console.log("send Sms");
    
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        variables_values: otp, // Pass OTP dynamically
        route: 'otp',
        numbers: phoneNumbers.join(','), // Convert array to comma-separated string
      },
      {
        headers: {
          authorization:process.env.SMS_API , // Replace with your actual API key
        },
      }
    );

    console.log('SMS Response:', response.data);
    return response.data; // Return response for further processing
  } catch (error) {
    console.error('Error sending SMS:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// // // Example Usage:
// const otpCode = '5599';
// const phoneList = ['9943751226'];

// sendSMS(otpCode, phoneList).catch(console.error);
