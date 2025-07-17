# Python Image Processing Service Setup

## Overview
This document outlines how to create and deploy the Python service for automated image splitting.

## Required Components

### 1. Python Application Structure
```
python-image-processor/
├── app.py                  # Main Flask/FastAPI application
├── requirements.txt        # Python dependencies
├── image_processor.py      # Core image splitting logic
├── config.py              # Configuration settings
└── Dockerfile             # For containerization
```

### 2. Core Dependencies
```txt
# requirements.txt
flask==2.3.3
opencv-python==4.8.1.78
numpy==1.24.3
pillow==10.0.0
requests==2.31.0
supabase==1.0.4
python-dotenv==1.0.0
```

### 3. Image Processing Logic
```python
# image_processor.py
import cv2
import numpy as np
from PIL import Image
import io
import base64

class PetriImageSplitter:
    def __init__(self):
        self.target_width = 800
        self.target_height = 600
    
    def split_image(self, image_data):
        """Split a single image containing two petri dishes"""
        
        # Convert base64 or URL to opencv image
        image = self.load_image(image_data)
        
        # Get image dimensions
        height, width = image.shape[:2]
        
        # Simple vertical split (assumes petris are side-by-side)
        mid_point = width // 2
        
        # Extract left and right halves
        left_image = image[:, :mid_point]
        right_image = image[:, mid_point:]
        
        # Resize to standard dimensions
        left_resized = cv2.resize(left_image, (self.target_width, self.target_height))
        right_resized = cv2.resize(right_image, (self.target_width, self.target_height))
        
        # Convert back to base64 for storage
        left_b64 = self.image_to_base64(left_resized)
        right_b64 = self.image_to_base64(right_resized)
        
        return left_b64, right_b64
    
    def load_image(self, image_data):
        """Load image from various sources"""
        # Implementation depends on your image storage
        pass
    
    def image_to_base64(self, image):
        """Convert opencv image to base64 string"""
        _, buffer = cv2.imencode('.jpg', image)
        return base64.b64encode(buffer).decode('utf-8')
```

### 4. Flask Application
```python
# app.py
from flask import Flask, request, jsonify
from image_processor import PetriImageSplitter
import os

app = Flask(__name__)
splitter = PetriImageSplitter()

@app.route('/process-split', methods=['POST'])
def process_split():
    try:
        data = request.json
        main_observation_id = data['main_observation_id']
        main_image_url = data['main_image_url']
        left_observation_id = data['left_observation_id']
        right_observation_id = data['right_observation_id']
        
        # Process the image
        left_image, right_image = splitter.split_image(main_image_url)
        
        # Upload split images to your storage (Supabase Storage)
        left_url = upload_to_storage(left_image, f"split_{left_observation_id}")
        right_url = upload_to_storage(right_image, f"split_{right_observation_id}")
        
        return jsonify({
            'success': True,
            'left_image_url': left_url,
            'right_image_url': right_url
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def upload_to_storage(image_data, filename):
    """Upload processed image to Supabase Storage"""
    # Implementation depends on your storage setup
    pass

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
```

## Deployment Options

### Option A: Local Development
1. Install Python dependencies
2. Set environment variables
3. Run locally: `python app.py`
4. Set `PYTHON_APP_URL=http://localhost:5000` in Supabase

### Option B: Cloud Deployment
1. **Heroku**: Easy deployment with git push
2. **Railway**: Modern alternative to Heroku
3. **Google Cloud Run**: Serverless container deployment
4. **AWS Lambda**: With container support

### Option C: Supabase Edge Functions (Advanced)
Convert to TypeScript and deploy as Edge Function:
```typescript
// supabase/functions/process-split-images/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { main_observation_id, main_image_url, left_observation_id, right_observation_id } = await req.json()
  
  // Image processing logic in TypeScript/Deno
  // Use libraries like https://deno.land/x/imagescript
  
  return new Response(JSON.stringify({
    success: true,
    left_image_url: "processed_left_url",
    right_image_url: "processed_right_url"
  }), {
    headers: { "Content-Type": "application/json" }
  })
})
```

## Configuration Steps

### 1. Set Environment Variables in Supabase
```bash
# In your Supabase project settings
PYTHON_APP_URL=https://your-python-app.herokuapp.com
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy process_split_petris
supabase functions deploy trigger_split_processing
```

### 3. Set Up Automated Triggers
Option A: Database trigger on INSERT
Option B: Cron job to check for unprocessed images
Option C: Webhook from frontend after image upload

## Testing the Setup

### 1. Create a Split Template
```sql
-- Create a site with split image template
INSERT INTO petri_defaults (site_id, petri_code, is_split_image_template, split_left_code, split_right_code)
VALUES ('your-site-id', 'P1', true, 'P1_Left', 'P1_Right');
```

### 2. Test Manual Processing
```sql
-- Test the processing function
SELECT trigger_manual_split_processing('your-observation-id');
```

### 3. Monitor Processing Status
```sql
-- Check processing status
SELECT * FROM get_split_processing_status();
```

## Security Considerations

1. **API Authentication**: Secure the Python service with API keys
2. **Image Validation**: Validate image formats and sizes
3. **Rate Limiting**: Prevent abuse of processing endpoints
4. **Error Handling**: Graceful handling of processing failures
5. **Storage Security**: Secure image storage and access

## Performance Optimization

1. **Async Processing**: Use task queues for large images
2. **Caching**: Cache processed images
3. **Compression**: Optimize image sizes
4. **Batch Processing**: Process multiple images together
5. **Monitoring**: Track processing times and success rates