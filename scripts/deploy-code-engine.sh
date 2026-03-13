#!/bin/bash

# IBM Recap - Code Engine Deployment Script
# Modern serverless deployment to IBM Cloud

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   IBM Recap - Code Engine Deployment  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Configuration
PROJECT_NAME="ibm-recap"
APP_NAME="ibm-recap"
REGION="us-south"

# Check if logged in
echo -e "${YELLOW}🔐 Checking IBM Cloud login status...${NC}"
if ! ibmcloud target &> /dev/null; then
    echo -e "${RED}❌ Not logged in to IBM Cloud${NC}"
    echo -e "${YELLOW}Please run: ibmcloud login --sso${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Logged in to IBM Cloud${NC}"

# Target region
echo -e "\n${YELLOW}🎯 Targeting region: ${REGION}...${NC}"
ibmcloud target -r ${REGION}

# Create or select Code Engine project
echo -e "\n${YELLOW}📦 Setting up Code Engine project...${NC}"
if ! ibmcloud ce project get --name ${PROJECT_NAME} &> /dev/null; then
    echo -e "${YELLOW}Creating new project: ${PROJECT_NAME}...${NC}"
    ibmcloud ce project create --name ${PROJECT_NAME}
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Project created${NC}"
    else
        echo -e "${RED}❌ Failed to create project${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Project already exists${NC}"
fi

# Select the project
echo -e "${YELLOW}Selecting project...${NC}"
ibmcloud ce project select --name ${PROJECT_NAME}

# Build and deploy application
echo -e "\n${YELLOW}🚀 Building and deploying application...${NC}"
echo -e "${YELLOW}This may take 3-5 minutes...${NC}\n"

# Deploy from source code
ibmcloud ce application create \
  --name ${APP_NAME} \
  --build-source . \
  --strategy dockerfile \
  --port 8787 \
  --min-scale 0 \
  --max-scale 1 \
  --cpu 0.25 \
  --memory 0.5G \
  --env-from-configmap ibm-recap-config 2>/dev/null || \
ibmcloud ce application update \
  --name ${APP_NAME} \
  --build-source . \
  --strategy dockerfile \
  --port 8787 \
  --min-scale 0 \
  --max-scale 1 \
  --cpu 0.25 \
  --memory 0.5G

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅ Deployment Successful!            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    
    # Get app URL
    APP_URL=$(ibmcloud ce application get --name ${APP_NAME} --output json | grep -o '"url":"[^"]*' | cut -d'"' -f4)
    
    echo -e "\n${GREEN}🌐 Your app is live at:${NC}"
    echo -e "${BLUE}   ${APP_URL}${NC}"
    
    echo -e "\n${YELLOW}📋 Next Steps:${NC}"
    echo -e "1. Set environment variables for API keys"
    echo -e "2. Configure w3ID authentication (if needed)"
    echo -e "3. Test the application"
    echo -e "4. Share the URL with your team"
    
    echo -e "\n${YELLOW}🔧 Set Environment Variables:${NC}"
    echo -e "${BLUE}ibmcloud ce application update --name ${APP_NAME} \\${NC}"
    echo -e "${BLUE}  --env OPENAI_API_KEY=your-key \\${NC}"
    echo -e "${BLUE}  --env WATSON_STT_API_KEY=your-key${NC}"
    
    echo -e "\n${YELLOW}📊 Useful Commands:${NC}"
    echo -e "View logs:    ${BLUE}ibmcloud ce application logs --name ${APP_NAME}${NC}"
    echo -e "View status:  ${BLUE}ibmcloud ce application get --name ${APP_NAME}${NC}"
    echo -e "Update app:   ${BLUE}ibmcloud ce application update --name ${APP_NAME}${NC}"
    echo -e "Delete app:   ${BLUE}ibmcloud ce application delete --name ${APP_NAME}${NC}"
    
else
    echo -e "\n${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   ❌ Deployment Failed                 ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    
    echo -e "\n${YELLOW}🔍 Troubleshooting:${NC}"
    echo -e "1. Check logs: ${BLUE}ibmcloud ce application logs --name ${APP_NAME}${NC}"
    echo -e "2. Verify Dockerfile exists"
    echo -e "3. Check package.json configuration"
    echo -e "4. Ensure you have sufficient quota"
    
    exit 1
fi

# Made with Bob
