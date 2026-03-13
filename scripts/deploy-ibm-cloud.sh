#!/bin/bash

# IBM Recap - IBM Cloud Foundry Deployment Script
# This script automates the deployment process to IBM Cloud

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   IBM Recap - Cloud Deployment        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if IBM Cloud CLI is installed
if ! command -v ibmcloud &> /dev/null; then
    echo -e "${RED}❌ IBM Cloud CLI not found${NC}"
    echo -e "${YELLOW}Installing IBM Cloud CLI...${NC}"
    curl -fsSL https://clis.cloud.ibm.com/install/osx | sh
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install IBM Cloud CLI${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ IBM Cloud CLI installed${NC}"
fi

# Check if logged in
echo -e "\n${YELLOW}🔐 Checking IBM Cloud login status...${NC}"
if ! ibmcloud target &> /dev/null; then
    echo -e "${YELLOW}Not logged in. Please login to IBM Cloud...${NC}"
    ibmcloud login --sso
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Login failed${NC}"
        exit 1
    fi
fi

# Target Cloud Foundry
echo -e "\n${YELLOW}🎯 Targeting Cloud Foundry...${NC}"
ibmcloud target --cf

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to target Cloud Foundry${NC}"
    echo -e "${YELLOW}Please select your organization and space${NC}"
    exit 1
fi

# Check if App ID service exists
echo -e "\n${YELLOW}🔍 Checking for App ID service...${NC}"
if ! ibmcloud resource service-instance ibm-recap-appid &> /dev/null; then
    echo -e "${YELLOW}📦 Creating App ID service...${NC}"
    ibmcloud resource service-instance-create ibm-recap-appid appid lite us-south
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ App ID service created${NC}"
        
        # Create service key
        echo -e "${YELLOW}🔑 Creating service key...${NC}"
        ibmcloud resource service-key-create ibm-recap-appid-key Manager --instance-name ibm-recap-appid
        echo -e "${GREEN}✅ Service key created${NC}"
    else
        echo -e "${YELLOW}⚠️  App ID service creation failed or already exists${NC}"
    fi
else
    echo -e "${GREEN}✅ App ID service already exists${NC}"
fi

# Deploy application
echo -e "\n${YELLOW}🚀 Deploying IBM Recap to Cloud Foundry...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}\n"

ibmcloud cf push

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅ Deployment Successful!            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    
    # Get app URL
    APP_URL=$(ibmcloud cf app ibm-recap | grep "routes:" | awk '{print $2}')
    
    echo -e "\n${GREEN}🌐 Your app is live at:${NC}"
    echo -e "${BLUE}   https://${APP_URL}${NC}"
    
    echo -e "\n${YELLOW}📋 Next Steps:${NC}"
    echo -e "1. Configure w3ID authentication in IBM Cloud Console"
    echo -e "2. Set environment variables for API keys"
    echo -e "3. Test the application"
    echo -e "4. Share the URL with your team"
    
    echo -e "\n${YELLOW}🔧 Useful Commands:${NC}"
    echo -e "View logs:    ${BLUE}ibmcloud cf logs ibm-recap${NC}"
    echo -e "View status:  ${BLUE}ibmcloud cf app ibm-recap${NC}"
    echo -e "Restart app:  ${BLUE}ibmcloud cf restart ibm-recap${NC}"
    
    echo -e "\n${GREEN}📚 See IBM_CLOUD_DEPLOYMENT.md for detailed configuration${NC}"
    
else
    echo -e "\n${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   ❌ Deployment Failed                 ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    
    echo -e "\n${YELLOW}🔍 Troubleshooting:${NC}"
    echo -e "1. Check logs: ${BLUE}ibmcloud cf logs ibm-recap --recent${NC}"
    echo -e "2. Verify manifest.yml configuration"
    echo -e "3. Check package.json for missing dependencies"
    echo -e "4. Ensure you have sufficient quota"
    
    exit 1
fi

# Made with Bob
