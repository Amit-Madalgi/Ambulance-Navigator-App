import React, { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonText } from "@/components/ui/button";
import { Link, LinkText } from "@/components/ui/link";
import { useToast, Toast, ToastTitle } from "@/components/ui/toast";
import "@/global.css";
import { auth } from "@/firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

export default function RegisterScreen() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password) {
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="solid" className="mt-12">
              <ToastTitle>Please fill all fields.</ToastTitle>
            </Toast>
          );
        },
      });
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      router.replace("/(tabs)");
    } catch (error: any) {
      toast.show({
        placement: "top",
        render: ({ id }) => {
          return (
            <Toast nativeID={id} action="error" variant="solid" className="mt-12">
              <ToastTitle>{error.message || "Failed to register"}</ToastTitle>
            </Toast>
          );
        },
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      className="bg-background-light"
    >
      <Center className="flex-1 w-full px-6">
        <VStack space="xl" className="w-full max-w-[400px]">
          <Center>
            <Heading size="3xl" className="text-secondary-800 mb-2 text-center">
              Create Account
            </Heading>
            <Text size="md" className="text-secondary-600 mb-8 text-center">
              Join Ambulance Navigator today.
            </Text>
          </Center>

          <VStack space="md">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Full Name</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder="Enter your name"
                  value={name}
                  onChangeText={setName}
                />
              </Input>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Email</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </Input>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>Password</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  placeholder="Create a password"
                  type="password"
                  secureTextEntry={true}
                  value={password}
                  onChangeText={setPassword}
                />
              </Input>
            </FormControl>
          </VStack>

          <Button size="lg" onPress={handleRegister} className="mt-6">
            <ButtonText>Register</ButtonText>
          </Button>

          <Center className="flex-row items-center gap-1.5 mt-4">
            <Text className="text-secondary-800">Already have an account?</Text>
            <Link onPress={() => router.push("/")}>
              <LinkText className="text-primary-600 font-bold">Log In</LinkText>
            </Link>
          </Center>
        </VStack>
      </Center>
    </KeyboardAvoidingView>
  );
}
